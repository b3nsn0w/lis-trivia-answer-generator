const fs = require('fs/promises')
const yaml = require('js-yaml')

const pageBlacklist = [
  'life_is_strange__different_languages_.txt',
  'life_is_strange__franchise_.txt',
  'life_is_strange__true_colors.txt',
  'life_is_strange_wiki_staff.txt'
]

const removeCategoryLinks = (text) => {
  return text.replace(/\[\[Category:[^\]]+\]\]/g, '')
}

// language links are formatted as [[language:page name]], where language can be a two-letter code or two letters followed by a hyphen and a two-letter code
const removeLanguageLinks = (text) => {
  return text.replace(/\[\[[a-z]{2}(-[a-z]{2})?:[^\]]+\]\]/g, '')
}

// free tabs start with {{Free Tab | (with arbitrary whitespace, including newlines) and end with }}
const removeFreeTabs = (text) => {
  return text.replace(/\{\{Free Tab\s*\|[\s\S]*?\}\}/g, '')
}

// introquotes are formatted as {{Introquote|text|author|source|date|location|image|caption|extra}}
const turnIntroquotesIntoMarkdown = (text) => {
  return text.replace(/\{\{Introquote\|([\s\S]*?)\}\}/g, (match, p1) => {
    const [text, author, source, date, location, image, caption, extra] = p1.split('|')
    return `> ${text}\n\n${author ? `**${author}**` : ''}${source ? `, ${source}` : ''}${date ? `, ${date}` : ''}${location ? `, ${location}` : ''}${image ? `, ${image}` : ''}${caption ? `, ${caption}` : ''}${extra ? `, ${extra}` : ''}`
  })
}

const removeSection = (text, sectionName) => {
  // the format might be == Section Name == or ==Section Name==, so we need to account for that
  const withoutSpaces = text.replace(new RegExp(`== ?${sectionName} ?==`, 'g'), `==${sectionName}==`)
  const sectionStart = withoutSpaces.indexOf(`==${sectionName}==`)
  if (sectionStart === -1) return withoutSpaces
  const sectionEnd = withoutSpaces.indexOf('==', sectionStart + `==${sectionName}==`.length)
  return withoutSpaces.slice(0, sectionStart) + withoutSpaces.slice(sectionEnd)
}

const removeSections = (text, ...sectionNames) => {
  return sectionNames.reduce((text, sectionName) => removeSection(text, sectionName), text)
}

// leave only one empty line between paragraphs
const removeRepeatedWhitespace = (text) => {
  return text.replace(/\n{3,}/g, '\n\n')
}

const wikiHtmlToMarkdown = (html) => {
  return html
    .replace(/<br\/?>/g, '\n')
    // remove html tags
    .replace(/<[^>]+>/g, '')
    // turn wiki bold into markdown bold
    .replace(/'''([^']+)'''/g, '**$1**')
    // turn wiki italics into markdown italics
    .replace(/''([^']+)''/g, '*$1*')
    // turn wiki headings into markdown headings
    .replace(/===([^=]+)===/g, '### $1')
    .replace(/==([^=]+)==/g, '## $1')
    .replace(/=([^=]+)=/g, '# $1')
    // turn wiki links into markdown links
    .replace(/\[\[([^\]]+)\]\]/g, (match, p1) => {
      const [name, url] = p1.split('|')
      const filename = (url || name).replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.md'
      return `[${name}](${filename})`
    })
}

const parseInfobox = (infobox) => {
  // remove "Infobox" from the beginning
  const infoboxType = infobox.slice(0, infobox.indexOf('|')).trim().replace(/^Infobox /, '')

  const lines = infobox.split('|').slice(1)
  const parsed = {}
  for (const line of lines) {
    const [key, value] = line.split('=')
    parsed[key.trim()] = wikiHtmlToMarkdown(value?.trim() || '')
  }

  return `

${infoboxType}

${yaml.dump(parsed)}
  
  `.trim()
}

const extractInfobox = (text) => {
  const infoboxStart = text.indexOf('{{Infobox')
  if (infoboxStart === -1) return null

  const infoboxEnd = text.indexOf('}}', infoboxStart)
  const infobox = text.slice(infoboxStart + 2, infoboxEnd).trim()
  return parseInfobox(infobox)
}

const removeInfoBox = (text) => {
  const infoboxStart = text.indexOf('{{Infobox')
  const infoboxEnd = text.indexOf('}}', infoboxStart)
  return text.slice(0, infoboxStart) + text.slice(infoboxEnd + 2)
}

const processFile = async (filename) => {
  if (pageBlacklist.includes(filename)) return

  let text = await fs.readFile(`wiki-pages-raw/${filename}`, 'utf8')

  // exclude page if it's a stub
  if (text.includes('{{Stub}}')) return

  // insert processing steps here
  text = removeCategoryLinks(text)
  text = removeLanguageLinks(text)
  text = turnIntroquotesIntoMarkdown(text)
  text = removeFreeTabs(text)
  text = removeSections(text,
    'Gallery',
    'Life is Strange 2',
    'References',
    'External Links'
  )

  const infobox = extractInfobox(text)
  text = removeInfoBox(text)

  // include the infobox as a yaml code segment at the top of the file, after the title, if it exists
  if (infobox) {
    // use a regex to find the title, which is currently in wiki format (= Title =)
    const title = text.match(/=+ [^=]+ =+/)[0]
    text = text.replace(title, `
    
${title}

${'```'}yaml
${infobox}
${'```'}

    `.trim())
  }

  text = wikiHtmlToMarkdown(text)
  text = removeRepeatedWhitespace(text)

  const filenameWithoutExtension = filename.replace('.txt', '')

  await fs.writeFile(`wiki-pages-processed/${filenameWithoutExtension}.md`, text)
}

const run = async () => {
  const files = await fs.readdir('wiki-pages-raw')

  // reset the processed folder
  await fs.rmdir('wiki-pages-processed', { recursive: true })
  await fs.mkdir('wiki-pages-processed')

  for (const file of files) {
    console.log(`Processing ${file}`)
    await processFile(file)
  }

  console.log('Done!')
}

run()
