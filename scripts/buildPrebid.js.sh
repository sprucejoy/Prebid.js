rm -rf dist
mkdir dist
# build Prebid.js for EPJ
npm run build:epj
cp build/dist/prebid.js dist/epj_prebid.min.js
# build Prebid.js for OPJ
npm run build:opj
cp build/dist/prebid.js dist/opj_prebid.min.js
