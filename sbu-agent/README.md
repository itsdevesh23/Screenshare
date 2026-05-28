# SBU Native Control Agent

This prototype enables inspector mouse clicks to control the SBU computer.

Browser WebRTC can share the screen, but browsers cannot control another computer's operating system. This agent runs on the SBU PC and uses Java `Robot` to perform approved mouse clicks during an accepted inspection session.

## Run

Start backend and frontend first. Then, on the SBU PC:

```powershell
cd "C:\Users\deves\OneDrive\Documents\Screenshare\sbu-agent"
mvn package
java -jar target\sbu-agent-0.0.1-SNAPSHOT.jar --backend http://127.0.0.1:8080 --username sbu1 --password password
```

## Test Flow

1. Inspector sends an access request.
2. SBU accepts the request.
3. SBU starts screen sharing and selects the full screen.
4. Start this agent on the SBU PC.
5. Inspector clicks inside the shared screen video.
6. The agent maps that click to the SBU primary display.

For accurate control, SBU should share the full screen, not only a browser tab.

## Security Notes

This is a development prototype. Before production use, add:

- SBU consent prompt before enabling control
- Visible control-on indicator
- Action audit logs
- Session timeout
- Admin policy for who can control which SBU
- Signed agent installer
- Restricted network and TLS certificates

