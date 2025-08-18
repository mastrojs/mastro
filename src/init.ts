/**
 * This script initializes an empty Mastro project for deno.
 * Usage: deno run -A jsr:@mastrojs/mastro@0.1.3/init
 * @module
 */

const templateRepo = "template-basic-deno";
const dir = prompt("What folder should we create for your new project?");

if (dir) {
  // download zip file from GitHub
  const res = await fetch(`https://github.com/mastrojs/${templateRepo}/archive/refs/heads/main.zip`);
  const outDir = templateRepo + "-main"; // this cannot be changed and is determined by the zip file
  const zipFile = outDir + ".zip";
  if (res.ok && res.body) {
    await Deno.writeFile(zipFile, res.body);
  }

  // unzip (should work on unix and Windows 10 and later)
  const command = new Deno.Command("tar", { args: ["-xf", zipFile] });
  const { code, stdout, stderr } = await command.output();
  const unzipSuccess = code === 0;
  if (!unzipSuccess) {
    console.log(new TextDecoder().decode(stdout));
    console.error(new TextDecoder().decode(stderr));
  }
  await Deno.remove(zipFile);

  if (unzipSuccess) {
    await Deno.rename(outDir, dir);

    const codeStyle = "color: blue";
    console.log(`
Success!

Enter your project directory using %ccd ${dir}
%cThen start the dev server with: %cdeno task start`
    , codeStyle, "", codeStyle);
  }
}
