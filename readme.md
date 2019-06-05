# Simple Proxy
A suite of tools designed to be a working proxy on my schools Macbook Air line (no admin).
It consists of two pieces - a relay server and a Chrome extension. It uses SSH tunneling as a proxy.

# Customizing
You may edit the config.json after generation or edit the default values in the source code. It will ask for you to specify your username and password but will assume the default host.

# Building
After executing `npm install`, go over to the `/server` directory and run `npm run school-mac`.
You may now use the `P.app` file in the project root to run the server.

Next, install the unpacked Chrome extension that's located in `/extension`