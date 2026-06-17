import {
  ArrowRight,
  Check,
  Code2,
  Command,
  Download,
  GitBranch,
  GitPullRequest,
  Menu,
  Monitor,
  PanelLeftClose,
  Search,
  Terminal,
  X
} from 'lucide-react'
import type { ComponentType, JSX, SVGProps } from 'react'
import { useState } from 'react'
import reviewScreenshot from './assets/review-screenshot.png'

const downloadUrl = 'https://github.com/ZainW/differ/releases/latest'
const sourceUrl = 'https://github.com/ZainW/differ'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

const features: Array<{ icon: Icon; title: string; body: string }> = [
  {
    icon: GitPullRequest,
    title: 'Open reviews from the terminal',
    body: 'Launch the desktop UI from a PR number, a GitHub URL, a GitLab merge request URL, or the branch you already have checked out.'
  },
  {
    icon: PanelLeftClose,
    title: 'Navigate the real diff quickly',
    body: 'Keep the file tree, PR description, and split or unified diff views in one focused review surface.'
  },
  {
    icon: Search,
    title: 'Built for keyboard flow',
    body: 'Use shortcuts for the sidebar, diff layout, and file search so reviewing stays close to your editor workflow.'
  }
]

const commands = [
  { label: 'Auto-detect current branch', command: 'differ' },
  { label: 'Open a pull request number', command: 'differ 42' },
  { label: 'Open a forge URL', command: 'differ https://github.com/org/repo/pull/42' }
]

const stats = ['GitHub/GitLab', 'Electron app', 'Split/unified diffs', 'Session cleanup']

const navItems = [
  { label: 'Workflow', href: '#workflow' },
  { label: 'Install', href: '#install' }
]

function cn(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function AppHeader(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-5 sm:px-8 lg:px-10">
      <div className="flex items-center justify-between">
        <a className="flex min-h-12 items-center gap-3" href="#top" aria-label="Differ home">
          <span className="grid size-10 shrink-0 place-items-center rounded bg-[#171412] text-[#f7f4ee] shadow-sm">
            <GitBranch className="size-4" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold uppercase tracking-[0.24em] text-[#35302c] sm:text-sm">
            Differ
          </span>
        </a>

        <nav className="hidden items-center gap-2 text-sm font-medium text-[#514941] lg:flex">
          {navItems.map((item) => (
            <a
              className="rounded px-3 py-2 transition hover:bg-black/5"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
          <IconLink href={sourceUrl} label="Open Differ source" />
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <IconLink href={sourceUrl} label="Open Differ source" />
          <button
            className="inline-flex size-12 items-center justify-center rounded border border-[#171412]/15 bg-white/65 text-[#171412] transition hover:bg-white"
            type="button"
            aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <nav className="mt-3 grid gap-2 rounded border border-[#171412]/10 bg-white/90 p-2 shadow-[0_16px_40px_rgba(23,20,18,0.12)] backdrop-blur lg:hidden">
          {navItems.map((item) => (
            <a
              className="flex min-h-12 items-center rounded px-3 text-base font-medium text-[#35302c] transition hover:bg-[#f7f4ee]"
              href={item.href}
              key={item.href}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}

function IconLink({ href, label }: { href: string; label: string }): JSX.Element {
  return (
    <a
      className="inline-flex size-12 items-center justify-center rounded border border-[#171412]/15 bg-white/65 text-[#171412] transition hover:bg-white sm:size-10"
      href={href}
      aria-label={label}
    >
      <Code2 className="size-5 sm:size-4" aria-hidden="true" />
    </a>
  )
}

function ButtonLink({
  href,
  children,
  variant = 'primary',
  className
}: {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'inverse'
  className?: string
}): JSX.Element {
  return (
    <a
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded px-5 text-base font-semibold transition hover:-translate-y-0.5 sm:text-sm',
        variant === 'primary' &&
          'bg-[#171412] text-white shadow-[0_12px_30px_rgba(23,20,18,0.2)] hover:bg-[#2a2521]',
        variant === 'secondary' &&
          'border border-[#171412]/15 bg-white/75 text-[#171412] hover:bg-white',
        variant === 'inverse' && 'bg-[#f7f4ee] text-[#171412] hover:bg-white',
        className
      )}
      href={href}
    >
      {children}
    </a>
  )
}

function Eyebrow({
  icon: IconComponent,
  children
}: {
  icon?: Icon
  children: React.ReactNode
}): JSX.Element {
  return (
    <p className="inline-flex w-fit items-center gap-2 rounded border border-[#216b52]/20 bg-white/60 px-3 py-1.5 text-base font-medium text-[#216b52] sm:text-sm">
      {IconComponent && <IconComponent className="size-5 shrink-0 sm:size-4" aria-hidden="true" />}
      {children}
    </p>
  )
}

function SectionHeading({
  eyebrow,
  title,
  body,
  inverse = false
}: {
  eyebrow: string
  title: string
  body?: string
  inverse?: boolean
}): JSX.Element {
  return (
    <div className="max-w-[64ch]">
      <p
        className={cn(
          'text-sm font-semibold uppercase tracking-[0.22em]',
          inverse ? 'text-[#e3a05d]' : 'text-[#9a4f24]'
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          'mt-3 max-w-[14ch] text-4xl font-semibold leading-tight tracking-normal sm:max-w-[16ch] sm:text-5xl',
          inverse ? 'text-[#f7f4ee]' : 'text-[#171412]'
        )}
      >
        {title}
      </h2>
      {body && (
        <p
          className={cn(
            'mt-5 max-w-[58ch] text-lg leading-8 sm:text-lg',
            inverse ? 'text-[#d6cec4]' : 'text-[#5b524a]'
          )}
        >
          {body}
        </p>
      )}
    </div>
  )
}

function Hero(): JSX.Element {
  return (
    <section className="relative border-b border-[#24201d]/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(33,107,82,0.18),_transparent_34rem),linear-gradient(135deg,_rgba(255,255,255,0.72),_rgba(247,244,238,0.15))]" />
      <AppHeader />
      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-5 pb-5 pt-7 sm:px-8 md:pt-10 lg:min-h-[78dvh] lg:grid-cols-[0.88fr_1.12fr] lg:gap-10 lg:px-10 lg:pb-10">
        <div id="top" className="flex flex-col justify-center lg:pb-10">
          <Eyebrow icon={Monitor}>Desktop PR review from your shell</Eyebrow>
          <h1 className="mt-5 max-w-[7ch] text-5xl font-semibold leading-[0.95] tracking-normal text-[#171412] sm:text-7xl lg:text-8xl">
            Differ
          </h1>
          <p className="mt-5 max-w-[34ch] text-xl leading-8 text-[#514941] sm:mt-6">
            Review GitHub and GitLab pull requests in a fast Electron app, launched with the command
            you already use to inspect code.
          </p>
          <div className="mt-6 flex flex-row gap-3 sm:mt-9">
            <ButtonLink href={downloadUrl}>
              <Download className="size-5 shrink-0 sm:size-4" aria-hidden="true" />
              Download
            </ButtonLink>
            <ButtonLink href="#install" variant="secondary">
              <Command className="size-5 shrink-0 sm:size-4" aria-hidden="true" />
              See commands
            </ButtonLink>
          </div>
          <StatGrid className="mt-7 sm:mt-10" />
        </div>

        <div className="flex items-center lg:pb-12">
          <ProductFrame />
        </div>
      </div>
    </section>
  )
}

function StatGrid({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        'grid max-w-2xl grid-cols-2 gap-2 text-base text-[#514941] sm:text-sm',
        className
      )}
    >
      {stats.map((item) => (
        <div className="flex min-w-0 items-center gap-2" key={item}>
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#216b52] text-white sm:size-5">
            <Check className="size-4 sm:size-3" aria-hidden="true" />
          </span>
          <span className="min-w-0">{item}</span>
        </div>
      ))}
    </div>
  )
}

function ProductFrame(): JSX.Element {
  return (
    <div className="w-full overflow-hidden rounded-[min(1vw,12px)] border border-[#171412]/15 bg-[#171412] p-1.5 shadow-[0_30px_70px_rgba(23,20,18,0.24)] sm:p-2">
      <img
        className="block aspect-[1440/900] max-h-[150px] w-full rounded-[min(0.8vw,8px)] object-cover object-top md:max-h-[340px] lg:max-h-none"
        src={reviewScreenshot}
        alt="Differ reviewing a GitHub pull request with a file tree and split diff"
      />
    </div>
  )
}

function WorkflowSection(): JSX.Element {
  return (
    <section id="workflow" className="bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <SectionHeading
            eyebrow="Review loop"
            title="Keep code review close to the terminal."
            body="Differ keeps the context that usually gets split across browser tabs in one desktop surface."
          />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-[#171412]/10 bg-[#171412]/10 sm:grid-cols-4">
            {stats.map((item) => (
              <div
                className="bg-[#fbfaf7] p-4 text-base font-medium text-[#35302c] sm:p-5 sm:text-sm"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard feature={feature} index={index} key={feature.title} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  feature,
  index
}: {
  feature: (typeof features)[number]
  index: number
}): JSX.Element {
  const IconComponent = feature.icon

  return (
    <article className="group rounded border border-[#171412]/10 bg-[#fbfaf7] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(23,20,18,0.1)]">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded bg-[#216b52] text-white sm:size-10">
          <IconComponent className="size-6 sm:size-5" aria-hidden="true" />
        </span>
        <span className="font-mono text-base text-[#b9afa4] sm:text-sm">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <h3 className="mt-6 max-w-[18ch] text-2xl font-semibold leading-tight text-[#171412] sm:text-xl">
        {feature.title}
      </h3>
      <p className="mt-3 text-base leading-7 text-[#5b524a]">{feature.body}</p>
    </article>
  )
}

function InstallSection(): JSX.Element {
  return (
    <section
      id="install"
      className="border-y border-[#171412]/10 bg-[#24201d] px-5 py-16 text-[#f7f4ee] sm:px-8 sm:py-20 lg:px-10"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Download"
            title="Grab the desktop build, then launch reviews with one command."
            body="Install the macOS package to add differ to your PATH. Differ uses your existing gh or glab authentication, with no OAuth setup or hosted service."
            inverse
          />
          <ButtonLink className="mt-8 w-full sm:w-fit" href={downloadUrl} variant="inverse">
            <Download className="size-5 shrink-0 sm:size-4" aria-hidden="true" />
            Download latest release
            <ArrowRight className="size-5 shrink-0 sm:size-4" aria-hidden="true" />
          </ButtonLink>
        </div>

        <TerminalWindow />
      </div>
    </section>
  )
}

function TerminalWindow(): JSX.Element {
  return (
    <div className="overflow-hidden rounded border border-white/12 bg-black/30 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-[#e06d54]" />
          <span className="size-3 rounded-full bg-[#e3a05d]" />
          <span className="size-3 rounded-full bg-[#73b88f]" />
        </div>
        <div className="flex items-center gap-2 text-base text-[#a99f93] sm:text-sm">
          <Terminal className="size-5 sm:size-4" aria-hidden="true" />
          differ
        </div>
      </div>
      <div className="space-y-5 p-4 font-mono text-base leading-7 sm:p-5 sm:text-sm sm:leading-6">
        {commands.map((item) => (
          <div key={item.command}>
            <p className="text-[#a99f93]">{item.label}</p>
            <p className="mt-1 overflow-x-auto whitespace-nowrap text-[#f7f4ee]">
              <span className="text-[#73b88f]">$</span> {item.command}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SiteFooter(): JSX.Element {
  return (
    <footer className="bg-[#f7f4ee] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-base text-[#5b524a] sm:flex-row sm:items-center sm:text-sm">
        <p>Differ is an Electron and React app for GitHub and GitLab PR review.</p>
        <div className="flex gap-4">
          <a className="font-semibold text-[#171412] hover:underline" href={downloadUrl}>
            Releases
          </a>
          <a className="font-semibold text-[#171412] hover:underline" href={sourceUrl}>
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}

export function App(): JSX.Element {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f7f4ee] text-[#171412]">
      <Hero />
      <WorkflowSection />
      <InstallSection />
      <SiteFooter />
    </main>
  )
}
