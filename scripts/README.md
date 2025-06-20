# scripts

Se necesitan menos configuraciones que el modo kiosk. Para un máquina con debian y LXDE. 

``
sudo apt update
``
Nuevo usuario kiosk (aunque es otra cosa)

``
sudo useradd -m kiosk-user
``

En caso de que sea necesario:

``
sudo apt install sudo xorg chromium openbox lightdm
``

Editar

``
sudo nano /etc/lightdm/lightdm.conf
``

Reemplazar con:

``
[SeatDefaults]
autologin-user=kiosk-user
user-session=openbox

Luego

``
sudo mkdir -p /home/kiosk-user/.config/openbox
sudo chown -R kiosk-user:kiosk-user /home/kiosk-user/.config
``
Después:

``
sudo vim /home/kiosk-user/.config/openbox/autostart
``

Aquí está la magia

``
chromium \
    --start-fullscreen \
    --app="http://www.google.com" \
    --disable-extensions
``
Y hace falta darle no traducción una vez.

