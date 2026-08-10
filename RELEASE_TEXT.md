# SALTA v0.8.22

SALTA v0.8.22 resolves three FRITZ!Box Presence CodeQL findings by documenting and narrowly suppressing the MD5 operations that are explicitly required by the FRITZ! TR-064 SOAP content-level authentication protocol.

## FRITZ!Box protocol-mandated MD5

- The FRITZ! TR-064 SOAP content-level authentication algorithm requires two MD5 operations:
  - `secret = MD5(uid:realm:password)`
  - `response = MD5(secret:nonce)`
- SALTA must keep these calculations unchanged to remain compatible with FRITZ!OS `InitChallenge` / `ClientAuth`.
- These MD5 operations are used only for the FRITZ!Box challenge-response protocol.
- They are not used for SALTA administrator password storage, session protection, encryption-key derivation, or any persistent password hash.

## CodeQL findings #8, #9 and #10

- Added query-specific inline suppression for `js/insufficient-password-hash` on the first AVM-mandated MD5 expression.
- The same first expression is also reported by `js/weak-cryptographic-algorithm`; because GitHub's suppression engine associates a `codeql[...]` comment with the immediately following line, both query-specific annotations are kept in one preceding comment using `codeql[...]` plus the still-supported `lgtm[...]` form.
- Added a query-specific `codeql[js/weak-cryptographic-algorithm]` suppression for the second AVM-mandated MD5 expression.
- Each suppression is accompanied by an in-source explanation that the operation is mandated for protocol interoperability and must not be replaced by an arbitrary stronger hash.
- The suppressions apply only to the two lines inside the FRITZ!Box SOAP content-authentication digest implementation.
- No CodeQL query is disabled globally and no repository-wide security rule is weakened.

## Security guardrails

- Added a dedicated section to `SECURITY.md` documenting the FRITZ!Box TR-064 MD5 exception and its scope.
- Release validation now requires exactly two direct `createHash("md5")` calls in the FRITZ!Box Presence source.
- Release validation also verifies the exact line-adjacent placement and count of the three query-specific suppressions used for CodeQL findings #8, #9 and #10.
- Introducing another direct MD5 call causes the SALTA release validation to fail.
- This prevents the FRITZ!Box interoperability exception from being reused for SALTA password hashing or other security-sensitive application logic.

## Compatibility

- FRITZ!Box Presence authentication behavior remains unchanged.
- The official AVM content-authentication test vector remains unchanged and continues to produce `b4f67585f22b0af7c4615db5a18faa14`.
- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No npm dependency was added or intentionally changed.
- Existing Presence targets and automations remain unchanged.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device and HomeKit functionality remains unchanged.

## Container tags

```text
0.8.22
0.8
latest
```

## Git tag

```text
v0.8.22
```
