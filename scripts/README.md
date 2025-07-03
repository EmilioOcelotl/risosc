# scripts

La siguiente configuración activa un modo kiosk para una computadora con entorno gráfico mínimo, que corre Debian, Openbox y LXDE

Con una instalación fresca de Debian, primero actualizar:

```
sudo apt update
sudo apt upgrade
```

Nuevo usuario kiosk

```
sudo useradd -m kiosk-user
```

En caso de que sea necesario:

```
sudo apt install sudo xorg chromium openbox lightdm
```

Editar

```
sudo nano /etc/lightdm/lightdm.conf
```

Para iniciar automáticamente es necesario reemplazar con:

```
[SeatDefaults]
autologin-user=kiosk-user
user-session=openbox
```

Para hacer ejecutable la configuración del kiosk mode:

```
sudo mkdir -p /home/kiosk-user/.config/openbox
sudo chown -R kiosk-user:kiosk-user /home/kiosk-user/.config
```

Hay que editar el archivo autostart que inicia programas al principio de todo.

```
sudo nano /home/kiosk-user/.config/openbox/autostart
```

Y agregamos las siguientes líneas: 

```
#!/bin/bash
xrandr --output HDMI-2 --mode 1920x1080

xset s off
xset -dpms
xset s noblank

chromium \
  --start-fullscreen \
  --app="https://risosc.ocelotl.cc" \
  --disable-extensions \
  --disable-translate \
  --disable-features=TranslateUI
```

xrandr ajusta el proyector por defecto y la resolución. Los valores pueden ser cambiados 

Los tres scripts de xset imposibilitan que la computadora apague la pantalla. 

Chromium lo que hace es iniciar en fullscreen, abre un enlace, deshabilita extensiones y supuestamente traducciones. Pero no sirvió, entonces cuando se abre una página por primera vez, es necesario cerrar el diálogo de traducción y nunca más vuelve a aparecer. 

## Web

Recomendación: usar nmtui para entornos mínimos pero todavía fáciles de usar. 

## Extra

La computadora se puede apagar a una hora determinada con cron. 

Para editar los eventos: 

```
sudo crontab -e
```

Va a solicitar un editor para cambiar crontab, selecciona uno. Después de que abre un editor, escribir la siguiente línea al final del archivo: 

```
22 13 * * * /sbin/shutdown -h now

```

Es importante dejar un espacio vacío abajo de la línea para que el archivo funcione. 

El primer número es el minuto y el segundo, la hora. Los asteriscos indican que la acción se repite cada día, de cada mes de cada año. En este caso, apagar la computadora. 