const axios = require('axios')
const jsdom = require('jsdom')
const fs = require('fs/promises')

const startingCategoryPageURL = 'https://life-is-strange.fandom.com/wiki/Category:Life_is_Strange'
const saveFolder = 'wiki-pages-raw'

const getPages = async (categoryPageURL) => {
  if (categoryPageURL !== startingCategoryPageURL) console.log(`Getting pages from ${new URL(categoryPageURL).searchParams.get('from')}...`)

  const { data } = await axios.get(categoryPageURL)

  const { window } = new jsdom.JSDOM(data)
  const { document } = window

  const pages = document.querySelectorAll('.category-page__member-link')

  const pageURLs = Array.from(pages).map(page => page.href).map(url => new URL(url, categoryPageURL).href)

  const nextPage = document.querySelector('.category-page__pagination-next')

  if (nextPage) {
    return pageURLs.concat(await getPages(nextPage.href))
  } else {
    return pageURLs
  }
}

// add ?action=edit to the end of the url
const urlToViewSourceUrl = (url) => {
  const urlObj = new URL(url)
  urlObj.searchParams.set('action', 'edit')
  return urlObj.href
}

const getSource = async (url, index, total) => {
  console.log(`Getting source for ${url} (${index + 1}/${total})...`)

  const { data } = await axios.get(urlToViewSourceUrl(url))
  const { window } = new jsdom.JSDOM(data)
  const { document } = window

  const source = document.querySelector('#wpTextbox1').value

  // remove "View source for " from the beginning if it's there
  const name = document.querySelector('#firstHeading').textContent.trim().replace(/^View source for /, '')

  return { name, source }
}

const savePage = async (url, index, total) => {
  const pageSource = await getSource(url, index, total)
  // pageSource.name but without special characters
  const filename = pageSource.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const nameRow = `= ${pageSource.name} =`
  await fs.writeFile(`${saveFolder}/${filename}.txt`, `${nameRow}\n\n${pageSource.source}`)
}

const throttledPromiseAll = (promiseFunctions, limit) => {
  const results = []

  const run = async () => {
    const promiseFunction = promiseFunctions.shift()
    if (promiseFunction) {
      results.push(await promiseFunction())
      return run()
    }
  }

  const promisesToRun = []

  for (let i = 0; i < limit; i++) {
    promisesToRun.push(run())
  }

  return Promise.all(promisesToRun).then(() => results)
}

const run = async () => {
  console.log('Getting pages...')
  const pages = await getPages(startingCategoryPageURL)

  console.log('Got pages!')

  console.log('Getting page sources...')

  await fs.mkdir(saveFolder, { recursive: true })

  await throttledPromiseAll(pages.map((page, index) => () => savePage(page, index, pages.length)), 10)

  console.log('Got page sources!')
}

run()
