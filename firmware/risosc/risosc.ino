#include <WiFi.h>
#include <HTTPClient.h>

// Configuración WiFi (REEMPLAZA CON TUS DATOS)
const char* ssid = "red";
const char* password = "contraseña";
const char* serverUrl = "direccion:3000/api/nfc"; // poner la ip local 

void setup() {
  Serial.begin(115200);
  
  // Conexión WiFi
  WiFi.begin(ssid, password);
  Serial.print("Conectando a WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nConectado! IP:");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    enviarDatosTest(); // Envía datos de prueba
  } else {
    Serial.println("WiFi desconectado. Reconectando...");
    WiFi.reconnect();
  }
  delay(5000); // Espera 5 segundos entre envíos
}

void enviarDatosTest() {
  HTTPClient http;
  
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  
  // Datos de prueba (luego reemplazarás con datos reales del NFC)
  String payload = "{\"uid\":\"TEST123\",\"status\":\"ok\"}";
  
  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    Serial.printf("Código HTTP: %d\n", httpCode);
    if (httpCode == HTTP_CODE_OK) {
      String response = http.getString();
      Serial.println("Respuesta del servidor: " + response);
    }
  } else {
    Serial.printf("Error en HTTP: %s\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
}
