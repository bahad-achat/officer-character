import { Badge } from "@mantine/core"
import FontAwesome from "./FontAwesome"
import { useInterval, useLocalStorage } from "@mantine/hooks"
import { OCSessionStatistics } from "../models"
import { useEffect, useState } from "react"
import { formatMinutes } from "../utilities"

const TimerBadge = () => {
  const [sessionStatistics] = useLocalStorage<OCSessionStatistics>({
    key: "Session Statistics",
    defaultValue: {},
  })
  const [now, setNow] = useState(new Date())

  const interval = useInterval(() => setNow(new Date()), 1000)

  useEffect(() => {
    interval.start()

    return interval.stop
  })

  if (!sessionStatistics.startDate) {
    return <></>
  }

  return (
    <Badge mr="xs" color="green" leftSection={<FontAwesome icon="clock" />}>
      זמן למידה:{" "}
      {formatMinutes(
        (now.getTime() - new Date(sessionStatistics.startDate).getTime()) /
          1000,
      )}
    </Badge>
  )
}

export default TimerBadge
