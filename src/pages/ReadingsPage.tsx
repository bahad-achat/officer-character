import { Button, Tooltip } from "@mantine/core"
import Container from "../components/Container"
import FontAwesome from "../components/FontAwesome"
import { useNavigate } from "react-router-dom"
import { setLocalStorage } from "../hooks"
import { OCPracticeInfo, OCSessionStatistics } from "../models"

const ReadingsPage = () => {
  const navigate = useNavigate()

  return (
    <Container>
      <h1 style={{ textAlign: "center" }}>מקראות</h1>
      <Button.Group orientation="vertical">
        {/* <Tooltip label="30 דקות לענות על 25 שאלות אקראיות מהמאגר!">
          <Button leftSection={<FontAwesome icon="stopwatch" />}>מבחן</Button>
        </Tooltip> */}
        <Tooltip label="מענה על שאלות אקראיות מהמאגר ללא הגבלת זמן/טעויות">
          <Button
            leftSection={<FontAwesome icon="dumbbell" />}
            onClick={() => {
              setLocalStorage("Session Statistics", {
                startDate: new Date().toString(),
              } as OCSessionStatistics)
              setLocalStorage("Practice Info", {
                remainingQuestionIndices: [],
                autoRestart: true,
              } as OCPracticeInfo)
              navigate("/readings/practice")
            }}
          >
            תרגול כללי
          </Button>
        </Tooltip>
        <Tooltip label="מענה על שאלות אקראיות מהמאגר של פרק ספציפי ללא הגבלת זמן/טעויות">
          <Button
            leftSection={<FontAwesome icon="bookmark" />}
            onClick={() => navigate("/readings/chapters")}
          >
            תרגול לפי פרק
          </Button>
        </Tooltip>
        {/* <Button
          leftSection={<FontAwesome icon="chart-simple" />}
          onClick={() => navigate("/readings/statistics")}
        >
          סטטיסטיקות
        </Button> */}
      </Button.Group>
    </Container>
  )
}

export default ReadingsPage
