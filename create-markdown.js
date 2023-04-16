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

// desired markdown format
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

const run = async () => {
  const questions = await fs.readFile('shuffled-questions.json', 'utf8')
  const parsedQuestions = JSON.parse(questions)

  // split the questions into chunks of 100
  const chunks = []
  let chunk = []
  for (let i = 0; i < parsedQuestions.length; i++) {
    if (chunk.length === 100) {
      chunks.push(chunk)
      chunk = []
    }
    chunk.push(parsedQuestions[i])
  }

  const markdown = chunks.map((chunk, index) => {
    const chunkMarkdown = chunk.map(({ id, chunk, question, answer, choices }) => {
      const choiceMarkdown = Object.keys(choices).map((key) => {
        return `${key}. ${choices[key]}`
      }).join('\n')

      return `
      
### ${id}

**${question}**

${choiceMarkdown}

Answer: ${answer}
related: [${chunk}](../wiki-pages-chunks/${chunk}.txt)

- [ ] Keep
- [ ] Delete
- [ ] Edit
  
      `.trim()
    }).join('\n\n')

    return `
# Questions ${index * 100 + 1} - ${index * 100 + chunk.length}

${chunkMarkdown}
    `.trim()
  })

  // reset the output folder
  await fs.rm('question-evaluations', { recursive: true, force: true })
  await fs.mkdir('question-evaluations')

  // write separate markdown files for each chunk
  await Promise.all(markdown.map((chunk, index) => {
    return fs.writeFile(`question-evaluations/questions-${index + 1}.md`, chunk)
  }))
}

run().catch(console.error)
