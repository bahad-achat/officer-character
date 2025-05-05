import { DirectionProvider, MantineProvider } from "@mantine/core"
import { DatesProvider } from "@mantine/dates"
import { useColorScheme } from "@mantine/hooks"
import { Route, BrowserRouter as Router, Routes } from "react-router-dom"
import Header from "./components/Header"
import DocumentPage from "./pages/DocumentPage"
import HomePage from "./pages/HomePage"
import SettingsPage from "./pages/SettingsPage"

import { ModalsProvider } from "@mantine/modals"
import "dayjs/locale/he"
import DocumentsPage from "./pages/DocumentsPage"
import { Notifications } from "@mantine/notifications"
import NewDocumentPage from "./pages/NewDocumentPage"
import ReadingsPage from "./pages/ReadingsPage"
import ReadingsChaptersPage from "./pages/ReadingsChaptersPage"
import ReadingsPracticePage from "./pages/ReadingsPracticePage"
import MigrationStart from "./components/MigrationStart"
import MigrationFinish from "./components/MigrationFinish"

const App = () => {
  const colorScheme = useColorScheme()

  return (
    <DirectionProvider>
      <DatesProvider
        settings={{
          timezone: "Asia/Jerusalem",
          locale: "he",
          firstDayOfWeek: 0,
          weekendDays: [5, 6],
        }}
      >
        <MantineProvider
          forceColorScheme={colorScheme}
          theme={{
            fontFamily:
              "IBM Plex Sans Hebrew, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
            colors: {
              primary: [
                "#f5efff",
                "#e6dcf2",
                "#c9b6e3",
                "#ac8ed3",
                "#946cc6",
                "#8456be",
                "#7d4bbb",
                "#6b3da5",
                "#5f3594",
                "#522d84",
              ],
            },
            primaryColor: "primary",
          }}
        >
          <Notifications />
          <Router>
            <ModalsProvider>
              <Header />
              <div
                style={{
                  flexGrow: 1,
                  overflow: "auto",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <MigrationStart />
                <Routes>
                  <Route path="/" Component={HomePage} />
                  <Route path="/finish-migration" Component={MigrationFinish} />
                  <Route path="/documents" Component={DocumentsPage} />
                  <Route path="/documents/:document" Component={DocumentPage} />
                  <Route path="/readings" Component={ReadingsPage} />
                  <Route
                    path="/readings/practice"
                    Component={ReadingsPracticePage}
                  />
                  <Route
                    path="/readings/chapters"
                    Component={ReadingsChaptersPage}
                  />
                  <Route path="/settings" Component={SettingsPage} />
                  <Route path="/documents/new" Component={NewDocumentPage} />
                  <Route
                    path="*"
                    element={
                      <p style={{ marginTop: 10 }}>
                        אופס! נראה שהדף הזה לא קיים...
                      </p>
                    }
                  />
                </Routes>
              </div>
            </ModalsProvider>
          </Router>
        </MantineProvider>
      </DatesProvider>
    </DirectionProvider>
  )
}

export default App
