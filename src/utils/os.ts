const platform = process.platform;

export function Windows(func: () => void) {
    if (platform === "win32") {
        func();
    }
}

export function Linux(func: () => void) {
    if (platform === "linux") {
        func();
    }
}

export function MacOS(func: () => void) {
    if (platform === "darwin") {
        func();
    }
}