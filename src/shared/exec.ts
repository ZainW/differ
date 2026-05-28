import { spawn } from 'child_process'

interface RunCommandOptions {
  cwd?: string
  reject?: boolean
}

interface RunCommandResult {
  stdout: string
  exitCode: number
}

export async function runCommand(
  file: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<RunCommandResult> {
  const reject = options.reject ?? true

  return new Promise((resolve, rejectPromise) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', rejectPromise)

    child.on('close', (code) => {
      const exitCode = code ?? 1
      if (reject && exitCode !== 0) {
        rejectPromise(
          new Error(
            `${file} ${args.join(' ')} failed (${exitCode}): ${stderr.trim() || stdout.trim()}`
          )
        )
        return
      }
      resolve({ stdout, exitCode })
    })
  })
}
