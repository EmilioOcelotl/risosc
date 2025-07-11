#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>
#include <NfcAdapter.h>

PN532_I2C pn532_i2c(Wire);
NfcAdapter nfc = NfcAdapter(pn532_i2c);

// Pines del LED RGB integrado (Ánodo Común)
#define LED_R 14  // Rojo
#define LED_G 15  // Verde
#define LED_B 16  // Azul

// Estados del sistema
enum SystemState {
  STATE_WAITING,    // Esperando tarjeta
  STATE_READING,    // Leyendo tarjeta
  STATE_READ,       // Tarjeta leída
  STATE_COOLDOWN    // Enfriamiento
};

SystemState currentState = STATE_WAITING;
unsigned long lastReadTime = 0;
const unsigned long COOLDOWN_TIME = 3000;

void setup() {
  Serial.begin(115200);
  Serial.println("NDEF Reader - Arduino Nano ESP32");
  
  // Configurar pines del LED RGB
  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  
  // Inicialmente todos apagados (HIGH en ánodo común)
  setColor(255, 255, 255);
  
  nfc.begin();
  setState(STATE_WAITING);
}

void loop() {
  switch(currentState) {
    case STATE_WAITING:
      if (nfc.tagPresent()) {
        setState(STATE_READING);
      }
      break;
      
    case STATE_READING:
      if (readTag()) {
        setState(STATE_READ);
        lastReadTime = millis();
      } else {
        setState(STATE_WAITING);
      }
      break;
      
    case STATE_READ:
      if (millis() - lastReadTime > 1000) {
        setState(STATE_COOLDOWN);
        lastReadTime = millis();
      }
      break;
      
    case STATE_COOLDOWN:
      if (millis() - lastReadTime > COOLDOWN_TIME) {
        setState(STATE_WAITING);
      }
      break;
  }
  delay(100);
}

bool readTag() {
  if (nfc.tagPresent()) {
    NfcTag tag = nfc.read();
    Serial.println("\n--- TAG DETECTADO ---");
    tag.print();
    Serial.println("---------------------");
    return true;
  }
  return false;
}

void setState(SystemState newState) {
  if (currentState == newState) return;
  currentState = newState;

  switch(currentState) {
    case STATE_WAITING:
      // AZUL - Esperando (Apagar Rojo y Verde)
      setColor(255, 255, 0);
      Serial.println("Estado: Esperando tarjeta (Azul)");
      break;
      
    case STATE_READING:
      // AMARILLO - Leyendo (Apagar Azul)
      setColor(0, 0, 255);
      Serial.println("Estado: Leyendo tarjeta (Amarillo)");
      break;
      
    case STATE_READ:
      // VERDE - Leído (Apagar Rojo y Azul)
      setColor(255, 0, 255);
      Serial.println("Estado: Tarjeta leída! (Verde)");
      break;
      
    case STATE_COOLDOWN:
      // MORADO - Enfriamiento (Apagar Verde)
      setColor(0, 255, 0);
      Serial.println("Estado: Enfriamiento (Morado)");
      break;
  }
}

// Función para controlar el LED RGB (Ánodo Común)
void setColor(int red, int green, int blue) {
  analogWrite(LED_R, red);
  analogWrite(LED_G, green);
  analogWrite(LED_B, blue);
}