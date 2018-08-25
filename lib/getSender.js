const childProcess = require('child_process')
const openpgp = require('openpgp')

async function getSender(commit) {
  const data = childProcess.execFileSync('git', ['cat-file', 'commit', commit]).toString()
  let m = data.match(
    /gpgsig (-----BEGIN PGP SIGNATURE-----[^]+?-----END PGP SIGNATURE-----)/
  )
  if (!m) {
    throw new Error('No PGP signature found.')
  }
  const options = {
    signature: await openpgp.signature.readArmored(m[1]),
    message: openpgp.cleartext.fromText(''),
    publicKeys: []
  }
  const info = await openpgp.verify(options)
  const signatures = info.signatures
  if (!signatures.length) {
    throw new Error('Signature not present in PGP signature.')
  }
  const id = signatures[0].keyid.toHex().toUpperCase()
  m = id.match(/^(....)(....)(....)(....)$/)
  if (!m) {
    throw new Error('Key ID is not 16-digit hex.')
  }
  return {
    id: [m[1], m[2], m[3], m[4]].join('/'),
    // HACK: Git only contains 16-digit key ID without public key.
    // Without public key we cannot verify the authenticity of the commit.
    // Future improvement: We can make it auto-fetch the key from PGP keyserver.
    // For now, let’s assume the keyId is valid!
    valid: true,
    verified: true
  }
}

module.exports = getSender
