# 3.0.1

Please checkout the 3.0.0 release notes for the changes in this major version.

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