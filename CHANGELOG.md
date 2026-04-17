# 4.0.0

**‼️ Breaking Changes**
- **You must re-add your TV accessory in the Home app after updating.** UUID generation has changed to be safe across different plugins, which means HomeKit will treat it as a new accessory.
- **Node.js 22 or later is now required.**

### Changed
- WoL packets are now sent to the TV’s IP and the correct subnet broadcast address instead of only `255.255.255.255`
- TV polling now uses a serialized timeout chain instead of `setInterval`, preventing socket exhaustion on resource-constrained systems

### Added
- `broadcast` config option to override the default broadcast address for WoL

### Fixed
- Input sources and apps are now cached to disk. The TV accessory appears immediately on Homebridge restart without needing the TV to be on
- Stale input sources and apps are now properly removed when the TV reports changes

# 3.0.3

### Changed
- Added Node.js 22 and 24 support
- Updated GitHub Actions to v6 and merged beta release workflow into release workflow

# 3.0.2

Tested homebridge v2 and found no major issues.

### Fixed
- Fixed an issue where homekit complains about specific characters in device names

### Added
- `hisense-tv authorize` now also checks if mac address was already authorized

# 3.0.1

Please checkout the 3.0.0 release notes for the changes in this major version.

### Changes
- **IMPORTANT** Combined `hisense-tv-authorize` and `hisense-tv-always-on-test` into one script `hisense-tv`
  - The script is now just `hisense-tv`
  - Authorize can be done with `hisense-tv authorize`
  - Always on test can be done with `hisense-tv always-on-test`
  - `hisense-tv listen-to-mqtt` is now available to listen to mqtt messages and debug the plugin

### Fixed
- Fixed an issue where the plugin crashes if malformed mqtt data is send
- Disabled sending mqtt data if the mqtt connection is down

# 3.0.0

This release has **braking changes**. 
Please read through the plugins documentation and update your configuration accordingly.

### Config Changes

- `ifname` is now `macaddress` and should be the mac address of the homebridge server
- changes in `devices`
  - `showApps` (default: false) - show apps as input sources
  - `apps` (default: []) - list of apps to show as input sources
    - if none are provided, all apps are shown
  - `tvType` for always on tvs added
    - `default` normal tv
    - `fakeSleep` tv with always on where fakeSleep property is used
    - `pictureSettings` tv with always on where sleep needs to be detected through the tvs picture settings
  - if `tvType` is `pictureSettings` the following properties are required
    - `menuId` - the picture setting to check for sleep
    - `menuFlag` - the value of the picture settings to check for sleep
  - Advanced Settings section:
    - `pollingInterval` (default: 4) - seconds to wait between polling the tv for the on/off state
      - if you have a tv that is always on, polling is disabled and changing this doesn't do anything
    - `wolInterval` (default: 400) - milliseconds to wait between sending WoL packets
    - `wolRetries` (default: 3) - number of times to send WoL packets to account for packet loss



### Changed
- Instead of using the ifname to get the macaddress, users should now enter there macaddress directly
- Plugin now connects to mqtt directly while tv is online
  - Connection will stay open as long as possible
  - Input Source is now updated in real time
  - Changing source with the home app works now most of the time
- WoL packets are now sent multiple times in the background
  - I noticed that the tv sometimes doesn't wake up on the first packet as the packet got lost or the network interface of the tv has some issues
- Removed telnet dependency as it wasn't used anymore


### Added
- Support for showing apps as Input Sources
  - showApps and apps config options
- Added support for always on tvs
  - see tvType and the menuId and menuFlag properties
- Added `hisense-tv-authorize` and `hisense-tv-always-on-test` scripts to help with the setup
- Added additional config properties
  - pollingInterval
  - wolInterval
  - wolRetries