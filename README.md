![Homebridge-Smartglass](images/header.png)

# Homebridge-Smartglass

<!-- [![Build and Lint](https://github.com/unknownskl/homebridge-smartglass/actions/workflows/build.yml/badge.svg?branch=release%2F1.0.2)](https://github.com/unknownskl/homebridge-smartglass/actions/workflows/build.yml)
[![npm](https://img.shields.io/npm/v/homebridge-smartglass.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-smartglass)
[![npm](https://img.shields.io/npm/dt/homebridge-smartglass.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-smartglass) -->


This is a plugin for Homebridge that allows you to control your RemoteNow-enabled HiSense TV, using the [hisensetv](https://github.com/newAM/hisensetv) tool. With this plugin, you can:

- See the status of your TV.
- Turn on and off.
- Show Input Sources and switch between them.
- Control the TV volume.
- Remote control using the native iOS remote.

## Requirements:

- NodeJS 10 or later.
- Homebridge 1.3.0 or later.
- Python 3.8.
- A HiSense TV that supports the RemoteNow app ([App Store](https://apps.apple.com/us/app/remotenow/id1301866548) or [Play Store](https://play.google.com/store/apps/details?id=com.universal.remote.ms&hl=en&gl=US)).

## Installation

Install the [hisensetv](https://github.com/newAM/hisensetv) command line tool.

```bash
sudo -H python3.8 -m pip install hisensetv
```

Install the plugin:

```bash
npm install -g homebridge-hisense-tv
```

## Setting up the TV

For this plugin to work correctly, you need to configure your TV to use a static DHCP (or configure a static reservation on your router). You also need to find your TV's MAC Address: this is usually displayed under Settings > Network Information, but it might vary based on your model.

To connect to your TV, you need to pair the machine where you're running Homebridge with your TV. This is done in the command line, by running the following command while your TV is turned on and connected to your local network:

```bash
hisensetv <IP ADDRESS> --authorize
```

Your TV, if compatible, will display a PIN code: insert it in the command line and confirm.

## Configure the plugin

TODO