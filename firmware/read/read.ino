#include <Wire.h>
#include <Adafruit_PN532.h>

#define PN532_IRQ   2
#define PN532_RESET 3

Adafruit_PN532 nfc(PN532_IRQ, PN532_RESET);

void setup() {
  Serial.begin(115200);
  Serial.println("Iniciando lector NFC...");

  nfc.begin();
  if (!nfc.getFirmwareVersion()) {
    Serial.println("Error: PN532 no detectado. Verifica conexiones.");
    while (1);
  }

  nfc.SAMConfig();
  Serial.println("Lector listo. Acerca el tag escrito para leerlo.");
}

void loop() {
  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
  uint8_t uidLength;

  if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength)) {
    Serial.println("\n=== Tag detectado ===");
    printUID(uid, uidLength);
    readTagContent();
    delay(300); // Espera 3 segundos para nuevo escaneo
  }
}

// Imprime el UID del tag
void printUID(uint8_t *uid, uint8_t uidLength) {
  Serial.print("UID: ");
  for (uint8_t i = 0; i < uidLength; i++) {
    Serial.print(uid[i], HEX);
    Serial.print(" ");
  }
  Serial.println();
}

// Lee y muestra el contenido del tag
void readTagContent() {
  uint8_t pageStart = 4; // Página inicial donde se escribe NDEF
  uint8_t pageEnd = 20;  // Página final típica para NTAG215
  bool tagReadSuccess = true;

  Serial.println("Contenido del tag (hex):");

  // Leer páginas y mostrar datos en hexadecimal
  for (uint8_t page = pageStart; page <= pageEnd; page++) {
    uint8_t data[4];
    if (nfc.ntag2xx_ReadPage(page, data)) {
      Serial.print("Pág ");
      Serial.print(page);
      Serial.print(": ");
      for (uint8_t i = 0; i < 4; i++) {
        Serial.print(data[i] < 0x10 ? "0" : ""); // Formato 2 dígitos
        Serial.print(data[i], HEX);
        Serial.print(" ");
      }
      Serial.println();
    } else {
      Serial.print("Error al leer página ");
      Serial.println(page);
      tagReadSuccess = false;
    }
  }

  // Decodificar NDEF si la lectura fue exitosa
  if (tagReadSuccess) {
    decodeNDEFFromPages(pageStart, pageEnd);
  }
}

// Decodifica el contenido NDEF
void decodeNDEFFromPages(uint8_t startPage, uint8_t endPage) {
  uint8_t buffer[128];
  uint8_t bufferIndex = 0;

  // Leer todas las páginas relevantes al buffer
  for (uint8_t page = startPage; page <= endPage && bufferIndex < sizeof(buffer); page++) {
    uint8_t pageData[4];
    if (nfc.ntag2xx_ReadPage(page, pageData)) {
      for (uint8_t i = 0; i < 4 && bufferIndex < sizeof(buffer); i++) {
        buffer[bufferIndex++] = pageData[i];
      }
    }
  }

  // Buscar registro NDEF (URI)
  for (uint8_t i = 0; i < bufferIndex - 4; i++) {
    if (buffer[i] == 0xD1 && buffer[i+1] == 0x01 && buffer[i+3] == 0x55) {
      uint8_t prefix = buffer[i+4];
      String url;

      // Determinar prefijo
      switch (prefix) {
        case 0x01: url = "http://www."; break;
        case 0x02: url = "https://www."; break;
        case 0x03: url = "http://"; break;
        case 0x04: url = "https://"; break;
        default:   url = "unknown://"; break;
      }

      // Extraer URL
      for (uint8_t j = i + 5; j < bufferIndex && buffer[j] != 0xFE; j++) {
        url += (char)buffer[j];
      }

      Serial.println("\n=== URL Detectada ===");
      Serial.println(url);
      return;
    }
  }

  Serial.println("\nNo se encontró estructura NDEF válida.");
  Serial.println("Posibles causas:");
  Serial.println("- El tag no fue escrito correctamente");
  Serial.println("- Los datos están corruptos");
  Serial.println("- No es un tag NTAG215");
}