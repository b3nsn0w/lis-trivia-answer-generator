const fs = require('fs/promises')

// example question:
// const question = {
//   "question": "What is the name of Kate Marsh's pet rabbit?",
//   "answer": "A",
//   "choices": {
//     "A": "Alice",
//     "B": "Whitey",
//     "C": "Carrot",
//     "D": "Bunny"
//   }
// }

// shuffle the contents of an array
const shuffleArray = (array) => {
  const result = []

  while (array.length > 0) {
    const index = Math.floor(Math.random() * array.length)
    result.push(array[index])
    array.splice(index, 1)
  }

  return result
}

// a function that reshuffles the choice order
const shuffleAnswers = (question) => {
  const { question: originalQuestion, answer, choices, ...rest } = question

  const letters = Object.keys(choices)
  const newOrder = shuffleArray([...letters])
  const getLetter = (letter) => newOrder[letters.indexOf(letter)]
  const newAnswer = getLetter(answer)

  return {
    ...rest,
    question: originalQuestion,
    answer: newAnswer,
    choices: letters
      .map(letter => ({ letter: getLetter(letter), choice: choices[letter] }))
      .sort((a, b) => a.letter.localeCompare(b.letter))
      .reduce((acc, { letter, choice }) => ({ ...acc, [letter]: choice }), {})
  }
}

const replaceTextInQuestion = (question, textToReplace, replacement) => {
  const { question: originalQuestion, answer, choices, ...rest } = question

  const newQuestion = originalQuestion.replace(textToReplace, replacement)
  const newChoices = Object.keys(choices).reduce((acc, letter) => {
    const choice = choices[letter]
    const newChoice = choice.replace(textToReplace, replacement)
    return { ...acc, [letter]: newChoice }
  }, {})

  return {
    ...rest,
    question: newQuestion,
    answer,
    choices: newChoices
  }
}

// create ids in the format of wiki-aaaaaaaa-0001 where "aaaaaaaa" is a hex value and "0001" is a sequential number
let nextSequentialId = 1
const createId = () => {
  const hex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
  const sequential = nextSequentialId.toString().padStart(4, '0')
  nextSequentialId += 1
  return `wiki-${hex}-${sequential}`
}

const run = async () => {
  console.log('Reading questions')

  const questions = await fs.readdir('wiki-pages-questions')
  const questionFiles = (await Promise.all(questions.map(async (questionFile) => {
    const withoutExtension = questionFile.replace(/\.json$/, '')

    const data = await fs.readFile(`wiki-pages-questions/${questionFile}`, 'utf8')
    return JSON.parse(data)
      .map(question => ({ chunk: withoutExtension, ...question }))
  }))).flat()

  console.log('Got', questionFiles.length, 'questions')

  const shuffledQuestions = questionFiles
    // .slice(0, 1) // remove this line to shuffle all questions
    .map(shuffleAnswers)
    .map(question => ({ id: createId(), ...question })) // put the id in front to be there in the final file
    .map(question => replaceTextInQuestion(question, 'Maxine', 'Max'))

  console.log('Writing questions')

  await fs.writeFile('shuffled-questions.json', JSON.stringify(shuffledQuestions, null, 2))

  console.log('Done')

  console.log('Answer distribution:')
  const answerDistribution = shuffledQuestions.reduce((acc, { answer }) => {
    const count = acc[answer] || 0
    return { ...acc, [answer]: count + 1 }
  }, {})
  Object.keys(answerDistribution)
    .sort((a, b) => a.localeCompare(b))
    .forEach(letter => console.log(letter, answerDistribution[letter]))
}

run()
