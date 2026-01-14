const fs = require('fs')
const path = require('path')

const version = process.env.RELEASE_VERSION
const ROOT_PACKAGE_KEY = '' // empty string key represents root package entry in package-lock.json

if (!version) {
  throw new Error('RELEASE_VERSION is not set')
}

const manifests = [
  { file: 'package.json', optional: false },
  { file: 'package-lock.json', optional: true }
]
let updated = false

for (const manifest of manifests) {
  const fullPath = path.join(process.cwd(), manifest.file)
  if (!fs.existsSync(fullPath)) {
    if (manifest.optional) {
      continue
    }
    throw new Error(`${manifest.file} not found; cannot apply release version`)
  }

  const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
  if (
    content.packages &&
    content.packages[ROOT_PACKAGE_KEY] &&
    content.packages[ROOT_PACKAGE_KEY] !== null &&
    typeof content.packages[ROOT_PACKAGE_KEY] === 'object'
  ) {
    content.packages[ROOT_PACKAGE_KEY].version = version
  }
  content.version = version
  fs.writeFileSync(fullPath, JSON.stringify(content, null, 2) + '\n')
  updated = true
}

if (!updated) {
  throw new Error('No manifest files updated; release version not applied')
}

console.log(`Applied release version ${version}`)
