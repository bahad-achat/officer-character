import { useNavigate } from "react-router-dom"
import Container from "../components/Container"
import { chapters, questions } from "../questions"
import { Button } from "@mantine/core"
import { setLocalStorage } from "../hooks"
import { OCPracticeInfo, OCPracticeStatistics } from "../models"

const ReadingsChaptersPage = () => {
  const navigate = useNavigate()

  return (
    <Container style={{ textAlign: "center" }}>
      <h1 style={{ textAlign: "center" }}>מקראות - תרגול לפי פרק</h1>
      {chapters.map((chapter, chapterIndex) => (
        <Button
          ml={5}
          mb={5}
          key={chapterIndex}
          onClick={() => {
            setLocalStorage("Session Statistics", {
              startDate: new Date().toString(),
            } as OCPracticeStatistics)
            setLocalStorage("Practice Info", {
              remainingQuestionIndices: questions
                .map((question, index) =>
                  question.chapter === chapterIndex + 1 ? index : undefined,
                )
                .filter((index) => index !== undefined),
              autoRestart: false,
            } as OCPracticeInfo)
            navigate("/readings/practice")
          }}
        >
          {chapterIndex + 1}. {chapter.name} (
          {
            questions.filter(
              (question) => question.chapter === chapterIndex + 1,
            ).length
          }{" "}
          שאלות)
        </Button>
      ))}
    </Container>
  )
}

export default ReadingsChaptersPage
