#include <Wire.h>
#include <Adafruit_PN532.h>

#define PN532_IRQ   2
#define PN532_RESET 3

Adafruit_PN532 nfc(PN532_IRQ, PN532_RESET);

void setup() {
  Serial.begin(115200);
  nfc.begin();

  if (!nfc.getFirmwareVersion()) {
    Serial.println("PN532 no detectado");
    while (1);
  }

  nfc.SAMConfig();
  Serial.println("Acerca un NTAG215 para borrar/escribir...");
}

void loop() {
  uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
  uint8_t uidLength;

  if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength)) {
    Serial.println("Tag detectado. Borrando datos antiguos...");

    // === "Borrado": Sobrescribe páginas 4 a 20 con 0x00 (ajusta el rango según necesidad) ===
    bool borradoExitoso = true;
    for (uint8_t page = 4; page <= 20; page++) {
      uint8_t emptyData[4] = {0x00, 0x00, 0x00, 0x00};
      if (!nfc.ntag2xx_WritePage(page, emptyData)) {
        borradoExitoso = false;
        break;
      }
    }

    if (borradoExitoso) {
      Serial.println("Datos antiguos borrados. Escribiendo nueva URL...");

      // === Escribir nueva URL (ejemplo: "https://ocelotl.cc") ===
      const char* url = "ocelotl.cc";  // Prefijo "https://" se añade automáticamente (0x03)
      uint8_t ndefRecord[] = {
        0xD1, 0x01, 0x0C, 0x55, 0x03,  // Cabecera NDEF + prefijo "https://"
        'o', 'c', 'e', 'l', 'o', 't', 'l', '.', 'c', 'c'  // URL sin "https://"
      };

      bool escrituraExitosa = true;
      for (uint8_t i = 0; i < sizeof(ndefRecord); i += 4) {
        uint8_t pageData[4];
        memcpy(pageData, &ndefRecord[i], 4);
        
        if (!nfc.ntag2xx_WritePage(4 + (i / 4), pageData)) {  // Escribe desde página 4
          escrituraExitosa = false;
          break;
        }
      }

      if (escrituraExitosa) {
        Serial.println("¡URL escrita correctamente!");
        Serial.println("Acerca el teléfono para abrir https://ocelotl.cc");
      } else {
        Serial.println("Error al escribir la URL");
      }
    } else {
      Serial.println("Error al borrar datos antiguos");
    }

    delay(5000);  // Espera 5 segundos
  }
}   