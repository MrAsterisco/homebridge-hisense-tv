# 3.0.0

- Plugin now connects to mqtt directly while tv is online
  - Input Source is now updated in real time
- TVs with always on display should be supported
- Added mandatory config option pollingInterval
    - Time to wait between polling the tv for the on/off state
- WoL Packet is now sent multiple times
  - configurable with the new config option wolRetries/wolInterval
