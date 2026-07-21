# SALTA v0.4.17

SALTA v0.4.17 adds configurable logical device functions for switchable Shelly devices.

A Shelly relay, outlet or light can now be presented as an automatically detected device, light, switch, outlet or fan. The physical Shelly type and command routing remain unchanged, while the selected function controls the dashboard icon, device label and HomeKit service.

The release adds persistent storage for the selected function, automatic schema migration, HomeKit `Lightbulb`, `Switch`, `Outlet` and `Fanv2` mappings, and protection against assigning these functions to non-switchable devices such as energy meters or window coverings.

No manual database migration is required.
