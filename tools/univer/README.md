# Univer bundle for Moltrix Sheet

`vendor/univer-1.6.0/` is a build of the open-source Univer spreadsheet (Apache-2.0) with React 18 and RxJS,
made from `entry.js` here:

```
npm i @univerjs/presets@1.6.0 @univerjs/preset-sheets-core@1.6.0 react@18 react-dom@18 rxjs esbuild
npx esbuild entry.js --bundle --minify --format=esm --splitting --outdir=../../vendor/univer-1.6.0 \
  --entry-names=univer --chunk-names=c-[hash] --loader:.css=css \
  --define:process.env.NODE_ENV='"production"' --legal-comments=linked
```

The licences of the bundled packages are in `univer.js.LEGAL.txt` and `LICENSE-univer.txt`.
For a new version build into a new folder (`vendor/univer-<version>/`) and change `VER` in `js/sheet.js`.
