import ignore from "ignore";
import { Zip } from "zip-lib";
import * as zipLib from "zip-lib";
import { join, relative } from "path";
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync } from "fs";

export async function zipFolderIgnoringGitignore(folderPath: string, password?: string) {
    const gitignorePath = join(folderPath, ".gitignore");
    let ig = ignore();

    if (existsSync(gitignorePath)) {
        ig = ignore().add(readFileSync(gitignorePath, "utf-8"));
    }

    function walkDir(dir: string) {
        return readdirSync(dir).flatMap((file: string): string[] => {
            const filePath = join(dir, file);
            const relativePath = relative(folderPath, filePath);
            if (ig.ignores(relativePath)) return [];
            const stat = statSync(filePath);
            return stat.isDirectory() ? walkDir(filePath) : [filePath];
        });
    }

    const zip = new Zip();
    const filesToZip = walkDir(folderPath);

    for (const filePath of filesToZip) {
        zip.addFile(filePath, relative(folderPath, filePath));
    }

    const zipName = `direct-${Date.now()}.zip`;
    await zip.archive(zipName);

    return {
        name: zipName,
    };
}

export async function extractZipToFolder(zipPath: string, extractPath: string, password?: string) {
    // Create the extraction directory if it doesn't exist
    if (!existsSync(extractPath)) {
        mkdirSync(extractPath, { recursive: true });
    }

    try {
        // Use the zipLib.extract method (zip-lib's extract function)
        await zipLib.extract(zipPath, extractPath);
    } catch (error) {
        throw new Error(`Failed to extract zip file: ${error}`);
    }
}
