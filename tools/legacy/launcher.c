#define UNICODE
#define _UNICODE
#include <windows.h>
#include <wchar.h>

int WINAPI wWinMain(HINSTANCE instance,HINSTANCE previous,LPWSTR command,int show){
    wchar_t root[32768],runtime[32768],bootstrap[32768],cmd[65536];
    if(!GetModuleFileNameW(NULL,root,32768))return 1;
    wchar_t *end=wcsrchr(root,L'\\');if(!end)return 1;*end=0;
    swprintf(runtime,32768,L"%ls\\runtime\\MSGHub.exe",root);
    if(GetFileAttributesW(runtime)==INVALID_FILE_ATTRIBUTES)
        swprintf(runtime,32768,L"%ls\\node_modules\\electron\\dist\\electron.exe",root);
    swprintf(bootstrap,32768,L"%ls\\electron\\desktop-bootstrap.cjs",root);
    if(GetFileAttributesW(runtime)==INVALID_FILE_ATTRIBUTES||GetFileAttributesW(bootstrap)==INVALID_FILE_ATTRIBUTES){
        MessageBoxW(NULL,L"Extraé el ZIP de transición dentro de la carpeta actual de MSG Hub y aceptá reemplazar archivos. MSGHub.exe reutiliza el motor ya instalado en node_modules\\electron\\dist. No borres esa carpeta ni abras el programa desde el ZIP.",L"MSG Hub",MB_OK|MB_ICONERROR);return 1;
    }
    SetEnvironmentVariableW(L"ELECTRON_RUN_AS_NODE",L"1");
    swprintf(cmd,65536,L"\"%ls\" \"%ls\"",runtime,bootstrap);
    STARTUPINFOW si={0};PROCESS_INFORMATION pi={0};si.cb=sizeof(si);si.dwFlags=STARTF_USESHOWWINDOW;si.wShowWindow=SW_HIDE;
    if(!CreateProcessW(runtime,cmd,NULL,NULL,FALSE,CREATE_NO_WINDOW,NULL,root,&si,&pi)){
        MessageBoxW(NULL,L"No se pudo iniciar MSG Hub. Comprobá que no se hayan movido sus carpetas electron y node_modules.",L"MSG Hub",MB_OK|MB_ICONERROR);return 1;
    }
    WaitForSingleObject(pi.hProcess,INFINITE);DWORD status=0;GetExitCodeProcess(pi.hProcess,&status);CloseHandle(pi.hThread);CloseHandle(pi.hProcess);
    if(status)MessageBoxW(NULL,L"MSG Hub no pudo completar el inicio o está actualizándose. Esperá a que se abra. Si no abre, revisá MSGHub-inicio-error.txt en la carpeta del programa. No borres .msghub-updates: conserva la recuperación.",L"MSG Hub",MB_OK|MB_ICONWARNING);
    return (int)status;
}
