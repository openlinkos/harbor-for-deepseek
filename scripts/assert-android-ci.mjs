import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mirrorUrl = 'https://maven-central.storage-download.googleapis.com/maven2/'
const failures = []

const fail = (message) => {
  failures.push(message)
}

const read = (path) => readFileSync(join(root, path), 'utf8')

const jobBody = (workflow, jobName, nextJobName) => {
  const start = workflow.indexOf(`\n  ${jobName}:`)
  if (start < 0) {
    fail(`${jobName} job was not found`)
    return ''
  }
  if (!nextJobName) {
    return workflow.slice(start)
  }
  const end = workflow.indexOf(`\n  ${nextJobName}:`, start + 1)
  if (end < 0) {
    fail(`${jobName} job was not found before ${nextJobName}`)
    return ''
  }
  return workflow.slice(start, end)
}

const assertGradleCache = (label, job) => {
  const setupJava = job.indexOf('actions/setup-java@')
  const nextStep = job.indexOf('\n      - ', setupJava + 1)
  const block = setupJava < 0 ? '' : job.slice(setupJava, nextStep < 0 ? job.length : nextStep)
  const usesSetupGradle = job.includes('gradle/actions/setup-gradle@')
  if (!/cache:\s*gradle\b/.test(block) && !usesSetupGradle) {
    fail(`${label} must cache Gradle with actions/setup-java cache: gradle or gradle/actions/setup-gradle`)
  }
}

const assertRetry = (label, job) => {
  if (!job.includes('bash scripts/android-gradle-retry.sh')) {
    fail(`${label} must resolve dependencies with scripts/android-gradle-retry.sh`)
  }
  if (/continue-on-error:\s*true/.test(job)) {
    fail(`${label} must not set continue-on-error: true`)
  }
}

const assertRepositoryOrder = (label, text) => {
  const blocks = text.match(/repositories\s*\{[\s\S]*?\n    \}/g) ?? []
  if (blocks.length < 2) {
    fail(`${label} must declare both buildscript and project repositories`)
  }
  for (const block of blocks) {
    const googleAt = block.indexOf('google()')
    const mirrorAt = block.indexOf(mirrorUrl)
    const centralAt = block.indexOf('mavenCentral()')
    if (googleAt < 0 || mirrorAt < 0 || centralAt < 0 || !(googleAt < mirrorAt && mirrorAt < centralAt)) {
      fail(`${label} repositories must list google(), then ${mirrorUrl}, then mavenCentral()`)
    }
  }
}

const ci = read('.github/workflows/ci.yml')
const android = jobBody(ci, 'android', 'ios')
assertGradleCache('CI android job', android)
assertRetry('CI android job', android)
if (!android.includes('node scripts/assert-android-ci.mjs')) {
  fail('CI android job must run scripts/assert-android-ci.mjs')
}

const release = read('.github/workflows/android-release.yml')
const apk = jobBody(release, 'apk')
assertGradleCache('android-release apk job', apk)
assertRetry('android-release apk job', apk)

const retry = read('scripts/android-gradle-retry.sh')
if (!retry.includes('max_attempts=3')) {
  fail('dependency retry must attempt resolution 3 times')
}
if (!retry.includes('delay_seconds=$((delay_seconds * 2))')) {
  fail('dependency retry must back off exponentially')
}
if (!retry.includes('sleep "${delay_seconds}"')) {
  fail('dependency retry must sleep between attempts')
}
if (!retry.includes('./gradlew --refresh-dependencies dependencies --no-daemon')) {
  fail('dependency retry must run ./gradlew --refresh-dependencies dependencies --no-daemon')
}
if (!/exit "\$\{status\}"/.test(retry)) {
  fail('dependency retry must fail the step when every attempt fails')
}

assertRepositoryOrder('apps/mobile/android/build.gradle', read('apps/mobile/android/build.gradle'))

const settings = read('apps/mobile/android/settings.gradle')
for (const needle of [
  mirrorUrl,
  'https://repo.maven.apache.org/maven2',
  'MavenCentralMirror',
  'repos.remove(repo)',
  'preferMavenCentralMirror(project.buildscript.repositories)',
  'preferMavenCentralMirror(project.repositories)',
]) {
  if (!settings.includes(needle)) {
    fail(`apps/mobile/android/settings.gradle must keep the Maven Central mirror hook (${needle})`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Android CI keeps Gradle cache, Maven Central mirror, and dependency retries')
