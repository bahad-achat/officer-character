import { ActionIcon, Tooltip } from "@mantine/core"
import { useNavigate } from "react-router-dom"
import FontAwesome, { FontAwesomeIcon } from "./FontAwesome"

const LINKS: { label: string; icon: FontAwesomeIcon; url: string }[] = [
  {
    label: "מסמכים",
    icon: "file-lines",
    url: "/documents",
  },
  {
    label: "מקראות",
    icon: "book-bookmark",
    url: "/readings",
  },
  {
    label: "הגדרות",
    icon: "gear",
    url: "/settings",
  },
]

const Header = () => {
  const navigate = useNavigate()

  return (
    <div
      className="header"
      style={{
        width: "100%",
        height: 60,
        display: "flex",
        alignItems: "center",
        flex: "none",
      }}
    >
      <img
        className="header-logo"
        src="/logo.png"
        height={45}
        style={{ marginInline: 10, cursor: "pointer" }}
        onClick={() => navigate("/")}
      />
      <h3>דמות הקצין</h3>

      {LINKS.map((link, index) => (
        <Tooltip label={link.label} key={index}>
          <ActionIcon
            color="dark"
            size="lg"
            mr="xs"
            onClick={() => navigate(link.url)}
          >
            <FontAwesome icon={link.icon} />
          </ActionIcon>
        </Tooltip>
      ))}
    </div>
  )
}

export default Header
