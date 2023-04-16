const fs = require('fs/promises')

// example question
// {
//   "id": "wiki-73ef844f-2335",
//   "chunk": "maxine_caulfield-1080",
//   "question": "What Is The Name Of Chloe's Stepfather Who Complains About The Noise?",
//   "answer": "A",
//   "choices": {
//     "A": "David Madsen",
//     "B": "Zachary Riggins",
//     "C": "William",
//     "D": "Raymond Wells"
//   }
// }

// markdown format
// ### wiki-73ef844f-2335
//
// **What Is The Name Of Chloe's Stepfather Who Complains About The Noise?**
//
// A. David Madsen
// B. Zachary Riggins
// C. William
// D. Raymond Wells
//
// Answer: A
// related: [maxine_caulfield-1080](../wiki-pages-chunks/maxine_caulfield-1080.txt)
//
// - [ ] Keep
// - [ ] Delete
// - [ ] Edit

// export format
// {
//   "question": "What Is The Name Of Chloe's Stepfather Who Complains About The Noise?",
//   "option 1": "David Madsen",
//   "option 2": "Zachary Riggins",
//   "option 3": "William",
//   "option 4": "Raymond Wells",
//   "correct option": "1"
// }

const run = async () => {
  const questions = await fs.readFile('shuffled-questions.json', 'utf8')
  const parsedQuestions = JSON.parse(questions)

  // create export folder if it doesn't exist
  await fs.mkdir('export', { recursive: true })

  // load exported question titles into a Set
  const exportedTitles = new Set()
  const exportedFiles = await fs.readdir('export')
  for (const file of exportedFiles) {
    const exported = await fs.readFile(`export/${file}`, 'utf8')
    const parsedExported = JSON.parse(exported)
    for (const question of parsedExported) {
      exportedTitles.add(question.question)
    }
  }

  // questions are exported as export/questions-1.json, export/questions-2.json, etc.
  // find the next available file number
  let fileNumber = 1
  while (exportedFiles.includes(`questions-${fileNumber}.json`)) {
    fileNumber++
  }

  // load the markdown files from question-evaluations
  // build a new Set with the titles of the questions that have "[x] Keep" in the markdown

  const keepIds = new Set()
  const markdownFiles = await fs.readdir('question-evaluations')
  for (const file of markdownFiles) {
    const markdown = await fs.readFile(`question-evaluations/${file}`, 'utf8')
    const sections = markdown.split('###')
    for (const section of sections) {
      const lines = section.split('\n')
      const id = lines[0].trim()
      const keepLine = lines.find((line) => line.includes('[x] Keep'))
      if (keepLine) {
        keepIds.add(id)
      }
    }
  }

  console.log('Keeping', keepIds.size, 'questions')

  const exportQuestions = parsedQuestions
    .filter(({ question }) => !exportedTitles.has(question))
    .filter(({ id }) => keepIds.has(id))
    .map(({ question, answer, choices }) => {
      const option1 = choices.A
      const option2 = choices.B
      const option3 = choices.C
      const option4 = choices.D
      const correctOption = answer

      return {
        question,
        'option 1': option1,
        'option 2': option2,
        'option 3': option3,
        'option 4': option4,
        'correct option': correctOption
      }
    })

  if (exportQuestions.length === 0) {
    console.log('No questions to export')
    return
  }

  console.log('Exporting', exportQuestions.length, 'questions')

  await fs.writeFile(`export/questions-${fileNumber}.json`, JSON.stringify(exportQuestions, null, 2))
}

run()
