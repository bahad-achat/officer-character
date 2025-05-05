import { Alert, Button } from "@mantine/core"
import { setLocalStorage, useLocalStorage } from "../hooks"
import { OCPracticeInfo, OCSessionStatistics } from "../models"
import { questions } from "../questions"
import FontAwesome from "./FontAwesome"
import Container from "./Container"
import { useEffect } from "react"
import { formatMinutes } from "../utilities"

const ReadingsSessionSummary = () => {
  const [sessionStatistics, setSessionStatistics] =
    useLocalStorage<OCSessionStatistics>({
      key: "Session Statistics",
      defaultValue: {},
    })

  useEffect(() => {
    if (!sessionStatistics.endDate) {
      sessionStatistics.endDate = new Date().toString()
      setSessionStatistics({ ...sessionStatistics })
    }
  }, [sessionStatistics])

  const failedQuestions = Object.keys(sessionStatistics.mistakes ?? {}).sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10),
  )

  return (
    <Container>
      <h1 style={{ textAlign: "center" }}>סיכום הלמידה</h1>
      {sessionStatistics.correct !== undefined && (
        <Alert
          color="pink"
          mb="xs"
          icon={<FontAwesome icon="circle-question" />}
        >
          סה״כ {sessionStatistics.correct.length} תשובות נכונות ו-
          {Object.keys(sessionStatistics.mistakes ?? {}).length} טעויות.
        </Alert>
      )}
      {sessionStatistics.startDate !== undefined &&
        sessionStatistics.endDate !== undefined && (
          <Alert mb="xs" color="green" icon={<FontAwesome icon="clock" />}>
            זמן למידה:{" "}
            {formatMinutes(
              (new Date(sessionStatistics.endDate).getTime() -
                new Date(sessionStatistics.startDate).getTime()) /
                1000,
            )}
          </Alert>
        )}
      {failedQuestions.map((question) => {
        const questionIndex = parseInt(question, 10)
        const selectedAnswers = sessionStatistics.mistakes![questionIndex]
        return (
          <div key={question}>
            <h2 style={{ textAlign: "center" }}>
              {questions[questionIndex].prompt}
            </h2>
            {questions[questionIndex].answers.map((answer, answerIndex) => (
              <Button
                h="min-content"
                fullWidth
                display={
                  answer.correct || selectedAnswers.includes(answerIndex)
                    ? undefined
                    : "none"
                }
                variant={
                  answer.correct || selectedAnswers.includes(answerIndex)
                    ? "filled"
                    : "default"
                }
                color={answer.correct ? "green" : "red"}
                mb="xs"
                key={answerIndex}
                leftSection={
                  answer.correct || selectedAnswers.includes(answerIndex) ? (
                    answer.correct ? (
                      <FontAwesome icon="check" />
                    ) : (
                      <FontAwesome icon="xmark" />
                    )
                  ) : undefined
                }
              >
                <span
                  style={{
                    whiteSpace: "normal",
                    lineHeight: 1.5,
                    padding: 10,
                  }}
                >
                  {answer.text}
                </span>
              </Button>
            ))}
          </div>
        )
      })}
      {failedQuestions.length === 0 && (
        <Alert color="green" icon={<FontAwesome icon="crown" />}>
          אין טעויות!
        </Alert>
      )}
      <Button
        leftSection={<FontAwesome icon="rotate-left" />}
        fullWidth
        my="xl"
        onClick={() => {
          setLocalStorage("Session Statistics", {
            startDate: new Date().toString(),
          } as OCSessionStatistics)
          setLocalStorage("Practice Info", {
            remainingQuestionIndices: [],
            autoRestart: true,
          } as OCPracticeInfo)
        }}
      >
        התחלה מחדש
      </Button>
    </Container>
  )
}

export default ReadingsSessionSummary
