// 7 horas antes

#include "src/env.h"  // Contiene WIFI_SSID, WIFI_PASSWORD, API_URL

#include <Wire.h>
#include <PN532_I2C.h>
#include <PN532.h>

#undef NULL
#define NULL 0

#include <WiFi.h>
#include <HTTPClient.h>
#include "NfcAdapter.h"
#include <time.h>

// Pines
#define LED_R 14
#define LED_G 15
#define LED_B 16
#define PN532_POWER_PIN 5
#define BUZZER_PIN 4 // Buzzer pasivo

// Estados del sistema
enum SystemState {
  STATE_WAITING,
  STATE_PROCESSING,
  STATE_SUCCESS,
  STATE_ERROR,
  STATE_INIT,
  STATE_PARTY
};

SystemState currentState = STATE_INIT;
unsigned long lastStateChange = 0;
const unsigned long STATE_DELAY = 2000;
unsigned long lastAnimationTime = 0;

// NFC
PN532_I2C pn532_i2c(Wire);
NfcAdapter nfc = NfcAdapter(pn532_i2c);

// Animación de color
float hue = 0.0;
int rCurr = 0, gCurr = 0, bCurr = 0;

// ------------------- Buzzer no bloqueante -------------------
unsigned long lastBeepTime = 0;
bool buzzerOn = false;
const int beepInterval = 200; // ms, duración de cada beep en PROCESSING

// ------------------- Funciones buzzer -------------------
void playTone(int freq, int duration) {
  tone(BUZZER_PIN, freq, duration);
  delay(duration * 1.1);
  noTone(BUZZER_PIN);
}

void buzzerFeedback(SystemState state) {
  switch (state) {
    case STATE_SUCCESS:
      playTone(880, 100);
      playTone(1320, 150);
      break;

    case STATE_ERROR:
      playTone(220, 200);
      delay(100);
      playTone(220, 200);
      break;

    case STATE_WAITING:
    case STATE_INIT:
    case STATE_PARTY:
      // silencioso
      break;

    case STATE_PROCESSING:
      // ahora usamos buzzer no bloqueante en loop
      break;
  }
}

// ------------------- Setup -------------------
void setup() {
  Serial.begin(115200);
  Serial.println("🚀 Iniciando lector NFC...");

  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  pinMode(PN532_POWER_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  setColor(255, 255, 255); // Blanco = iniciando
  connectWiFi();
  syncTime();

  digitalWrite(PN532_POWER_PIN, HIGH); // Siempre encendido
  delay(500);
  nfc.begin();

  setState(STATE_WAITING);
}

// ------------------- Loop principal -------------------
void loop() {
  unsigned long now = millis();

  // Animación LEDs
  animateLEDs(now);

  // Buzzer no bloqueante en PROCESSING
  if (currentState == STATE_PROCESSING) {
    if (now - lastBeepTime >= beepInterval) {
      lastBeepTime = now;
      buzzerOn = !buzzerOn;
      if (buzzerOn) tone(BUZZER_PIN, 600);
      else noTone(BUZZER_PIN);
    }
  } else {
    noTone(BUZZER_PIN);  // asegurarse de apagar buzzer en otros estados
  }

  // Manejo estados
  switch (currentState) {
    case STATE_WAITING:
      if (nfc.tagPresent()) setState(STATE_PROCESSING);
      break;

    case STATE_PROCESSING:
      processTag();
      break;

    case STATE_SUCCESS:
    case STATE_ERROR:
      if (now - lastStateChange > STATE_DELAY) setState(STATE_WAITING);
      break;

    case STATE_PARTY:
      // Puede activarse manualmente para demo
      break;

    case STATE_INIT:
      // transición inicial ya hecha en setup
      break;
  }
}

// ------------------- Lógica NFC -------------------
void processTag() {
  Serial.println("🔍 Detectado - Leyendo...");

  if (!nfc.tagPresent()) {
    Serial.println("❌ Tag perdido durante lectura");
    setState(STATE_ERROR);
    return;
  }

  NfcTag tag = nfc.read();

  if (!tag.hasNdefMessage()) {
    Serial.println("❌ Tag no contiene NDEF");
    setState(STATE_ERROR);
    return;
  }

  NdefMessage message = tag.getNdefMessage();
  int foundIndex = -1;

  for (int i = 0; i < message.getRecordCount(); i++) {
    NdefRecord record = message.getRecord(i);
    if (record.getTnf() == TNF_WELL_KNOWN && record.getType() == "U") {
      String url = getUrlFromRecord(record);
      Serial.println("🔗 URL: " + url);

      foundIndex = getIndexFromUrl(url);
      if (foundIndex >= 0 && foundIndex <= 3) break;
    }
  }

  if (foundIndex >= 0) {
    Serial.println("🎯 Índice: " + String(foundIndex));
    sendToEndpoint(foundIndex);
  } else {
    Serial.println("❌ Índice no válido");
    setState(STATE_ERROR);
  }
}

void sendToEndpoint(int index) {
  Serial.println("📤 Enviando índice " + String(index) + " a: " + String(API_URL));

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Reconectando WiFi...");
    connectWiFi();
  }

  HTTPClient http;
  String payload = "{\"index\":" + String(index) + "}";

  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(payload);

  // Detener beep al terminar
  noTone(BUZZER_PIN);

  if (httpCode == 200) setState(STATE_SUCCESS);
  else setState(STATE_ERROR);

  http.end();
}

// ------------------- Extra NFC -------------------
String getUrlFromRecord(NdefRecord &record) {
  byte payload[record.getPayloadLength()];
  record.getPayload(payload);
  String url;

  switch (payload[0]) {
    case 0x01: url = "http://www."; break;
    case 0x02: url = "https://www."; break;
    case 0x03: url = "http://"; break;
    case 0x04: url = "https://"; break;
    default: url = ""; break;
  }

  for (int i = 1; i < record.getPayloadLength(); i++) url += (char)payload[i];
  return url;
}

int getIndexFromUrl(String url) {
  int paramStart = url.indexOf("?nfc=");
  if (paramStart == -1) return -1;

  String indexStr = url.substring(paramStart + 5);
  int ampPos = indexStr.indexOf('&');
  if (ampPos != -1) indexStr = indexStr.substring(0, ampPos);

  return indexStr.toInt();
}

// ------------------- Estados -------------------
void setState(SystemState newState) {
  if (currentState == newState) return;

  currentState = newState;
  lastStateChange = millis();

  buzzerFeedback(newState);

  switch (newState) {
    case STATE_WAITING: Serial.println("⏳ Esperando tarjeta..."); break;
    case STATE_PROCESSING: Serial.println("🔄 Procesando..."); break;
    case STATE_SUCCESS: Serial.println("🎉 Éxito!"); break;
    case STATE_ERROR: Serial.println("💥 Error"); break;
    case STATE_INIT: Serial.println("🚀 Iniciando..."); break;
    case STATE_PARTY: Serial.println("🎊 Fiesta!"); break;
  }
}

// ------------------- Animaciones LEDs -------------------
void animateLEDs(unsigned long now) {
  const int interval = 50;
  if (now - lastAnimationTime < interval) return;
  lastAnimationTime = now;

  switch (currentState) {
    case STATE_WAITING:
      hue += 1.5; if (hue > 360) hue = 0;
      hsvToRgb(hue, 0.6, 0.5, rCurr, gCurr, bCurr);
      setColor(rCurr, gCurr, bCurr);
      break;

    case STATE_PROCESSING:
      pulseColor(255, 200, 0, 500);
      break;

    case STATE_SUCCESS:
      pulseColor(0, 255, 0, 700);
      break;

    case STATE_ERROR:
      pulseDoubleRed(300, 100);
      break;

    case STATE_PARTY:
      randomColorFlash();
      break;

    case STATE_INIT:
      fadeToColor(255, 255, 255, 500);
      break;
  }
}

// ------------------- Funciones auxiliares -------------------
void setColor(int r, int g, int b) {
  analogWrite(LED_R, r);
  analogWrite(LED_G, g);
  analogWrite(LED_B, b);
}

void fadeToColor(int targetR, int targetG, int targetB, int duration) {
  rCurr = rCurr + (targetR - rCurr) / 10;
  gCurr = gCurr + (targetG - gCurr) / 10;
  bCurr = bCurr + (targetB - bCurr) / 10;
  setColor(rCurr, gCurr, bCurr);
}

void pulseColor(int r, int g, int b, int pulseTime) {
  int phase = (millis() % pulseTime);
  float factor = phase < (pulseTime / 2) ? (float)phase / (pulseTime/2) : 1.0 - (float)(phase - pulseTime/2) / (pulseTime/2);
  setColor(r * factor, g * factor, b * factor);
}

void pulseDoubleRed(int pulseTime, int pause) {
  int t = millis() % (pulseTime*2 + pause);
  if (t < pulseTime || (t >= pulseTime + pause && t < pulseTime*2 + pause)) setColor(255,0,0);
  else setColor(0,0,0);
}

void randomColorFlash() {
  static int lastChange = 0;
  if (millis() - lastChange > 150) {
    lastChange = millis();
    setColor(random(100,255), random(100,255), random(100,255));
  }
}

// ------------------- HSV → RGB -------------------
void hsvToRgb(float h, float s, float v, int &r, int &g, int &b) {
  int i = int(h / 60.0) % 6;
  float f = h / 60.0 - i;
  float p = v * (1 - s);
  float q = v * (1 - f * s);
  float t = v * (1 - (1 - f) * s);
  float rF, gF, bF;

  switch(i){
    case 0: rF=v; gF=t; bF=p; break;
    case 1: rF=q; gF=v; bF=p; break;
    case 2: rF=p; gF=v; bF=t; break;
    case 3: rF=p; gF=q; bF=v; break;
    case 4: rF=t; gF=p; bF=v; break;
    case 5: rF=v; gF=p; bF=q; break;
  }

  r = int(rF*255);
  g = int(gF*255);
  b = int(bF*255);
}

// ------------------- WiFi y NTP -------------------
void connectWiFi() {
  Serial.println("📡 Conectando WiFi...");
  setColor(255, 255, 0); // Amarillo

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) Serial.println("\n✅ WiFi: " + WiFi.localIP().toString());
  else Serial.println("\n❌ WiFi falló");
}

void syncTime() {
  configTzTime("CST6CDT,M3.2.0/2,M11.1.0/2", "pool.ntp.org", "time.nist.gov");

  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) Serial.printf("⏰ Hora: %02d:%02d:%02d\n", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
}
