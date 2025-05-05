import { useEffect, useState } from "react"
import { useLocalStorage } from "../hooks"
import {
  OCPracticeInfo,
  OCPracticeStatistics,
  OCSessionStatistics,
} from "../models"
import { questions } from "../questions"
import { shuffle } from "../utilities"
import { Alert, Badge, Button, Tooltip } from "@mantine/core"
import Container from "../components/Container"
import FontAwesome from "../components/FontAwesome"
import ReadingsSessionSummary from "../components/ReadingsSessionSummary"
import TimerBadge from "../components/TimerBadge"

const updateStatistics = (
  currentQuestionIndex: number,
  correct: boolean,
  statistics: OCPracticeStatistics,
) => {
  if (!statistics.questionStatistics) {
    statistics.questionStatistics = {}
  }
  if (!statistics.questionStatistics[currentQuestionIndex]) {
    statistics.questionStatistics[currentQuestionIndex] = {}
  }
  if (correct) {
    statistics.questionStatistics[currentQuestionIndex].success =
      (statistics.questionStatistics[currentQuestionIndex].success ?? 0) + 1
  } else {
    statistics.questionStatistics[currentQuestionIndex].fail =
      (statistics.questionStatistics[currentQuestionIndex].fail ?? 0) + 1
  }

  if (!correct) {
    statistics.streak = 0
  } else {
    statistics.streak = (statistics.streak ?? 0) + 1
  }
}

const ReadingsPracticePage = () => {
  const [practiceInfo, setPracticeInfo] = useLocalStorage<OCPracticeInfo>({
    key: "Practice Info",
    defaultValue: {},
  })
  const [practiceStatistics, setPracticeStatistics] =
    useLocalStorage<OCPracticeStatistics>({
      key: "Practice Statistics",
      defaultValue: {},
    })
  const [sessionStatistics, setSessionStatistics] =
    useLocalStorage<OCSessionStatistics>({
      key: "Session Statistics",
      defaultValue: {},
    })
  const [showCorrect, setShowCorrect] = useState(false)
  const [answers, setAnswers] = useState<{ text: string; correct?: boolean }[]>(
    [],
  )
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])

  const currentQuestionIndex =
    (practiceInfo.remainingQuestionIndices ?? [])[0] ?? 0
  const currentQuestion = questions[currentQuestionIndex]
  const currentQuestionStatistics =
    (practiceStatistics.questionStatistics ?? {})[currentQuestionIndex] ?? {}
  const currentQuestionCorrect = currentQuestionStatistics.success ?? 0
  const currentQuestionFail = currentQuestionStatistics.fail ?? 0
  const correctCount = currentQuestion.answers.filter(
    (answer) => answer.correct,
  ).length
  const correct = answers.every(
    (answer, answerIndex) =>
      (answer.correct ?? false) === selectedAnswers.includes(answerIndex),
  )

  useEffect(() => {
    if (
      practiceInfo.autoRestart &&
      (!practiceInfo.remainingQuestionIndices ||
        practiceInfo.remainingQuestionIndices.length === 0)
    ) {
      const remainingQuestionIndices = new Array(questions.length)
        .fill(0)
        .map((_, i) => i)
      shuffle(remainingQuestionIndices)
      setPracticeInfo({
        ...practiceInfo,
        remainingQuestionIndices,
      })
      setSessionStatistics({ startDate: new Date().toString() })
    }
  }, [practiceInfo])

  useEffect(() => {
    if (selectedAnswers.length === correctCount) {
      setShowCorrect(true)
    }
  }, [selectedAnswers])

  useEffect(() => {
    if (
      answers.length === 0 &&
      practiceInfo.remainingQuestionIndices?.length != 0
    ) {
      const answers = [...currentQuestion.answers]
      shuffle(answers)
      setAnswers(answers)
    }
  }, [practiceInfo, answers])

  if (
    !practiceInfo.remainingQuestionIndices ||
    practiceInfo.remainingQuestionIndices.length === 0 ||
    answers.length === 0
  ) {
    if (Object.keys(sessionStatistics).length !== 0) {
      return <ReadingsSessionSummary />
    }
    return <></>
  }

  const nextQuestion = () => {
    updateStatistics(currentQuestionIndex, correct, practiceStatistics)

    if (!sessionStatistics.mistakes) {
      sessionStatistics.mistakes = {}
    }
    if (!correct) {
      sessionStatistics.mistakes[currentQuestionIndex] = selectedAnswers.map(
        (selectedAnswer) =>
          currentQuestion.answers.findIndex(
            (x) => x.text === answers[selectedAnswer].text,
          ),
      )
    } else {
      sessionStatistics.correct = [
        ...(sessionStatistics.correct ?? []),
        currentQuestionIndex,
      ]
    }

    setPracticeStatistics({ ...practiceStatistics })
    if (practiceInfo.remainingQuestionIndices.length > 1) {
      setSessionStatistics({ ...sessionStatistics })
    }
    setSelectedAnswers([])
    setShowCorrect(false)
    setPracticeInfo({
      ...practiceInfo,
      remainingQuestionIndices: practiceInfo.remainingQuestionIndices.slice(1),
    })
    setAnswers([])
  }

  return (
    <Container style={{ marginTop: 20 }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Badge leftSection={<FontAwesome icon="circle-question" />}>
          שאלה {currentQuestionIndex + 1}
        </Badge>
        <Badge
          mr="xs"
          color="red"
          leftSection={
            practiceStatistics.streak && practiceStatistics.streak >= 5 ? (
              <FontAwesome icon="fire" />
            ) : undefined
          }
        >
          רצף: {practiceStatistics.streak ?? 0}
        </Badge>
        <Badge
          mr="xs"
          color="pink"
          leftSection={<FontAwesome icon="hourglass-start" />}
        >
          נותרו {practiceInfo.remainingQuestionIndices.length} שאלות
        </Badge>
        <TimerBadge />
        {currentQuestionCorrect + currentQuestionFail !== 0 && (
          <Tooltip label="מאזן מענה עבר על השאלה הזו">
            <Badge
              variant="default"
              mr="xs"
              style={{ fontFamily: "monospace" }}
            >
              {currentQuestionCorrect}{" "}
              <FontAwesome icon="check" props={{ style: { marginLeft: 10 } }} />
              {currentQuestionFail} <FontAwesome icon="xmark" />
            </Badge>
          </Tooltip>
        )}
        <h2>{currentQuestion.prompt}</h2>
        {answers.filter((answer) => answer.correct).length > 1 && (
          <p>סמנו את כל התשובות הנכונות</p>
        )}
      </div>
      {answers.map((answer, answerIndex) => (
        <Button
          h="min-content"
          fullWidth
          variant={
            selectedAnswers.includes(answerIndex) ||
            (showCorrect &&
              (answer.correct || selectedAnswers.includes(answerIndex)))
              ? "filled"
              : "default"
          }
          color={showCorrect ? (answer.correct ? "green" : "red") : undefined}
          mb="xs"
          key={answerIndex}
          leftSection={
            showCorrect &&
            (answer.correct || selectedAnswers.includes(answerIndex)) ? (
              answer.correct ? (
                <FontAwesome icon="check" />
              ) : (
                <FontAwesome icon="xmark" />
              )
            ) : undefined
          }
          onClick={() => {
            if (selectedAnswers.length === correctCount) {
              return
            }

            if (selectedAnswers.includes(answerIndex)) {
              setSelectedAnswers(
                selectedAnswers.filter((f) => f !== answerIndex),
              )
            } else {
              setSelectedAnswers([...selectedAnswers, answerIndex])
            }
          }}
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
      {correct && (
        <Alert color="green" icon={<FontAwesome icon="check" />}>
          תשובה נכונה!
        </Alert>
      )}
      {showCorrect ? (
        <Button
          mt="md"
          fullWidth
          rightSection={<FontAwesome icon="arrow-left" />}
          onClick={nextQuestion}
        >
          לשאלה הבאה
        </Button>
      ) : (
        <Button
          mt="md"
          fullWidth
          leftSection={<FontAwesome icon="flag-checkered" />}
          onClick={() => setPracticeInfo({ remainingQuestionIndices: [] })}
        >
          סיום הלמידה
        </Button>
      )}
      <Button
        component="a"
        href="https://docs.google.com/forms/d/e/1FAIpQLSdkf4HfSKKy3J7LQ_4udnreYr_ODxxVzZdGiZw7GoJbWEaZQw/viewform?usp=header"
        target="_blank"
        mt="md"
        leftSection={<FontAwesome icon="flag" />}
        color="red"
        fullWidth
      >
        דיווח על בעייה בשאלה
      </Button>
    </Container>
  )
}

export default ReadingsPracticePage
