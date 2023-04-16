require('dotenv').config()

const gptEncoder = require('gpt-3-encoder')
const fs = require('fs/promises')
const axios = require('axios')
const { env } = process

const apiKey = env.CHATGPT_API_KEY

const systemMessage = `

You create trivia questions for excerpts passed in by the user. Each trivia question has four options for answers, one of which is correct. The format for questions is as follows:

[Question] What Was One Of The Gifts Vanessa Sent Her Daughter?
[A] Hoodie
[B] Phone
[C] Cookies
[D] Film
[Answer] B

The topic of the trivia is Life is Strange. Create questions relevant to the excerpts.

A few rules:
- Do not create questions relevant to the ending where Chloe dies.
- Do not create questions relevant to Max and Warren's relationship.
- Do not use filenames or URLs in your questions.
- Do not use the word "trivia" in your questions.
- Try to avoid obscure details such as voice actors for non-essential characters.

If you cannot think of a question that fits the rules, you can skip the excerpt by typing [No Questions] on a new line.

`.trim()

const systemMessageTokens = gptEncoder.encode(systemMessage).length
console.log('System message tokens:', systemMessageTokens)

const exampleQuestions = [`

[Question] How Does Max Enter The Polarized Timeline?
[A] By Focusing On A Selfie
[B] By Using Her Time Rewind Power
[C] By Entering A Portal
[D] By Falling Asleep
[Answer] A

`, `

[Question] What Happens To Rachel Amber In The Polarized Timeline?
[A] She Escapes From The Dark Room
[B] She Is Rescued By Max
[C] She Is Found Dead
[D] She Is Arrested By The Police
[Answer] C

`].map(question => question.trim())

const exampleQuestionsTokens = exampleQuestions.reduce((total, question) => total + gptEncoder.encode(question).length, 0)
console.log('Example question tokens:', exampleQuestionsTokens)

const totalExpectedTokens = systemMessageTokens + exampleQuestionsTokens + 1536 + Math.round(exampleQuestionsTokens / 2 * 5)
console.log('Total expected tokens:', totalExpectedTokens)

const createQuestions = async (chunk) => {
  // create a chatgpt prompt, using the system message and example questions
  const messages = [
    { role: 'system', content: systemMessage },
    ...exampleQuestions.map(question => ({ role: 'assistant', content: question })),
    { role: 'user', content: chunk }
  ]

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-3.5-turbo',
    messages,
    max_tokens: 1023,
    temperature: 0.2,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    stop: ['[No Questions]']
  }, {
    headers: {
      authorization: `Bearer ${apiKey}`
    }
  })

  return response.data
}

// turn the question text into json
const parseQuestions = (question) => {
  const [questionText, ...options] = question.split('\n')
  const answer = options.find(option => option.startsWith('[Answer]')).split(']')[1].trim()[0]
  const choices = options
    .map(option => ({ letter: option.split(']')[0].slice(1), text: option.split(']')[1].trim() }))
    .filter(({ letter }) => letter !== 'Answer')
    .reduce((obj, { letter, text }) => ({ ...obj, [letter]: text }), {})

  return {
    question: questionText.split(']')[1].trim(),
    answer,
    choices
  }
}

const validateQuestion = (question) => {
  const { question: questionText, answer, choices } = question

  if (questionText.length < 10) return false
  if (questionText.length > 100) return false
  if (questionText.includes('trivia')) return false
  if (questionText.includes('http')) return false
  if (questionText.includes('www')) return false
  if (questionText.includes('file')) return false
  if (questionText.includes('filename')) return false
  if (questionText.includes('file name')) return false
  if (questionText.includes('file-name')) return false

  if (!answer) return false
  if (answer.length !== 1) return false
  if (!['A', 'B', 'C', 'D'].includes(answer)) return false

  if (Object.keys(choices).length !== 4) return false
  if (Object.keys(choices).some(key => !['A', 'B', 'C', 'D'].includes(key))) return false
  if (Object.values(choices).some(value => value.length < 5)) return false
  if (Object.values(choices).some(value => value.length > 100)) return false

  if (Object.values(choices).some(value => value.includes('trivia'))) return false
  if (Object.values(choices).some(value => value.includes('http'))) return false
  if (Object.values(choices).some(value => value.includes('www'))) return false
  if (Object.values(choices).some(value => value.includes('file'))) return false
  if (Object.values(choices).some(value => value.includes('filename'))) return false
  if (Object.values(choices).some(value => value.includes('file name'))) return false
  if (Object.values(choices).some(value => value.includes('file-name'))) return false

  return true
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
  const chunks = await fs.readdir('wiki-pages-chunks')

  console.log('Chunk count:', chunks.length)
  console.log('Full tokens:', chunks.length * totalExpectedTokens)
  console.log('Estimated cost:', (chunks.length * totalExpectedTokens / 1000 * 0.002).toLocaleString('en-US', { style: 'currency', currency: 'USD' }))

  // create the questions folder if it doesn't exist
  await fs.mkdir('wiki-pages-questions', { recursive: true })

  await throttledPromiseAll(chunks.map(chunk => async () => {
    const name = chunk.split('.')[0]

    // if the chunk is already processed, skip it
    if (await fs.access(`wiki-pages-questions/${name}.json`).then(() => true).catch(() => false)) {
      console.log(`Skipping ${chunk}...`)
      return
    }

    console.log(`Processing ${chunk}...`)

    const chunkContent = await fs.readFile(`wiki-pages-chunks/${chunk}`, 'utf8')
    const response = await createQuestions(chunkContent)

    const questions = response.choices[0].message.content.split('[Question]').slice(1).map(question => `[Question]${question.trim()}`)
    const parsedQuestions = questions.map(parseQuestions)

    const validQuestions = parsedQuestions.filter(validateQuestion)

    const validQuestionCount = validQuestions.length
    const invalidQuestionCount = parsedQuestions.length - validQuestionCount

    console.log('Result:', validQuestionCount, 'valid questions,', invalidQuestionCount, 'invalid questions')

    await fs.writeFile(`wiki-pages-questions/${name}.json`, JSON.stringify(validQuestions, null, 2))
  }), 10)

  console.log('Done!')
}

run()
