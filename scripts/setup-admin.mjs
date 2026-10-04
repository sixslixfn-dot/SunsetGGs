import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const scryptAsync = promisify(scrypt)
const envPath = new URL('../.env', import.meta.url)

function hiddenInput(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      reject(new Error('Run this setup command in an interactive VS Code terminal.'))
      return
    }

    let value = ''
    stdout.write(prompt)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    const onData = (key) => {
      if (key === '\u0003') {
        stdin.setRawMode(false)
        stdin.off('data', onData)
        stdin.pause()
        stdout.write('\n')
        reject(new Error('Setup cancelled.'))
        return
      }
      if (key === '\r' || key === '\n') {
        stdin.setRawMode(false)
        stdin.off('data', onData)
        stdin.pause()
        stdout.write('\n')
        resolve(value)
        return
      }
      if (key === '\u007f' || key === '\b') {
        value = value.slice(0, -1)
        return
      }
      if (key.length === 1 && key >= ' ') value += key
    }

    stdin.on('data', onData)
  })
}

async function main() {
  const readline = createInterface({ input: stdin, output: stdout })
  try {
    const usernameInput = (await readline.question('Admin username (fixed account: admin432; press Enter): ')).trim()
    const username = usernameInput || 'admin432'
    readline.close()

    if (username !== 'admin432') throw new Error('The only authorized admin account is admin432.')

    let password = ''
    while (true) {
      password = await hiddenInput('Admin password (minimum 14 characters; input hidden): ')
      if (password.length < 14) {
        console.log('Choose a password with at least 14 characters and try again.')
        continue
      }
      const confirmation = await hiddenInput('Confirm password (input hidden): ')
      if (password === confirmation) break
      console.log('The password entries did not match. Please enter them again.')
    }

    const salt = randomBytes(16).toString('hex')
    const hash = await scryptAsync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
    const lines = [
      '# Local secrets. Keep this file out of source control.',
      `ADMIN_USERNAME=${username}`,
      `ADMIN_PASSWORD_HASH=scrypt$${salt}$${hash.toString('hex')}`,
      'PUBLIC_ORIGIN=http://127.0.0.1:5173',
      '',
    ].join('\n')

    await writeFile(envPath, lines, { mode: 0o600 })
    console.log('Admin account configured in the ignored .env file. No password or hash was printed.')
    console.log('Restart the dev server if it is already running. The admin page is at /tacos7.')
  } finally {
    readline.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
