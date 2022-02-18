rm -rf dist
mkdir dist

# The standard build output contains all the available modules from within the modules folder.
npm run build:all

# bundle Prebid.js for EPJ
npm run bundle:epj
# npm run build:epj
# cp build/dist/prebid.js dist/epj_prebid.min.js

# bundle Prebid.js for OPJ
npm run bundle:opj
# npm run build:opj
# cp build/dist/prebid.js dist/opj_prebid.min.js
