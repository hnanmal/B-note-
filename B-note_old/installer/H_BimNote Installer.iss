#define MyVersion "1.3.9"

[Setup]
AppName=H_BimNote
AppVersion={#MyVersion}
WizardStyle=modern
; DefaultDirName={pf}\H_BimNote
DefaultDirName={autopf}\H_BimNote
DefaultGroupName=H_BimNote
OutputDir=.\installer
OutputBaseFilename=H_BimNote_Setup_{#MyVersion}
Compression=lzma
SolidCompression=yes

[Languages]
Name: "ko"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
; 앱 실행파일
Source: "..\dist\B-note.exe"; DestDir: "{app}"; Flags: ignoreversion

; resource 폴더 전체 복사
Source: "..\dist\resource\*"; DestDir: "{app}\resource"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\H_BimNote"; Filename: "{app}\B-note.exe"
Name: "{group}\Uninstall H_BimNote"; Filename: "{uninstallexe}"

