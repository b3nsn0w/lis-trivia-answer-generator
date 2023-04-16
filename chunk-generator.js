const fs = require('fs/promises')
const gptEncoder = require('gpt-3-encoder')

const MAX_TOKENS = 1536

const run = async () => {
  const filenames = await fs.readdir('wiki-pages-processed')

  const processedPages = await Promise.all(filenames.map(async (filename) => {
    const text = await fs.readFile(`wiki-pages-processed/${filename}`, 'utf8')

    // parse the text, returning the title (as # Title), and sections of the body delimited by ## headings
    const title = text.match(/# ([^#\n]+)/)[1].trim()
    console.log('Loading page:', title)

    const sections = text.split('## ').map((section, index) => {
      const text = (index === 0 ? '' : '## ') + section.trim()
      return {
        text,
        tokenCount: gptEncoder.encode(text).length
      }
    })

    return {
      title,
      sections,
      rawText: text,
      tokenCount: sections.reduce((total, section) => total + section.tokenCount, 0)
    }
  }))

  // show the highest token count page
  // const highestTokenCountPage = processedPages.reduce((highest, page) => {
  //   if (page.tokenCount > highest.tokenCount) return page
  //   return highest
  // }
  // , { tokenCount: 0 })

  // console.log('Highest token count page:', highestTokenCountPage.title)
  // console.log('Token count:', highestTokenCountPage.tokenCount)
  // console.log('Sections:', highestTokenCountPage.sections.length)
  // console.log('Section token counts:', highestTokenCountPage.sections.map(section => section.tokenCount))

  console.log('Writing chunks...')

  // reset the chunks directory
  await fs.rm('wiki-pages-chunks', { recursive: true, force: true })
  fs.mkdir('wiki-pages-chunks', { recursive: true })

  for (const page of processedPages) {
    const filename = page.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const chunkPrefix = `Here is a section of the wiki page for ${page.title}:\n\n`
    const chunkPostfix = '\n\nGenerate five trivia questions relevant to this section of the page.'

    // if the page is small enough, just write it out as a single chunk
    if (page.tokenCount < MAX_TOKENS) {
      await fs.writeFile(`wiki-pages-chunks/${filename}.txt`, chunkPrefix + page.rawText + chunkPostfix)
      continue
    }

    // otherwise, split it into chunks
    let chunk = ''
    let chunkTokenCount = 0

    for (const section of page.sections) {
      if (chunkTokenCount + section.tokenCount > MAX_TOKENS) {
        await fs.writeFile(`wiki-pages-chunks/${filename}-${chunkTokenCount}.txt`, chunkPrefix + chunk + chunkPostfix)
        chunk = ''
        chunkTokenCount = 0
      }

      // if the section is too big to fit in a single chunk, split it up, watching for word boundaries
      if (section.tokenCount > MAX_TOKENS) {
        const words = section.text.split(' ')
        let wordIndex = 0
        while (wordIndex < words.length) {
          const word = words[wordIndex]
          const wordTokenCount = gptEncoder.encode(word).length

          if (chunkTokenCount + wordTokenCount > MAX_TOKENS) {
            await fs.writeFile(`wiki-pages-chunks/${filename}-${chunkTokenCount}.txt`, chunkPrefix + chunk + chunkPostfix)
            chunk = ''
            chunkTokenCount = 0
          }

          chunk += word + ' '
          chunkTokenCount += wordTokenCount
          wordIndex++
        }
      } else {
        chunk += section.text + '\n\n'
        chunkTokenCount += section.tokenCount
      }
    }
  }

  console.log('Done!')
}

run()
