import './styles.css'
import { ViteReactSSG } from 'vite-react-ssg'
import Layout from './components/Layout'
import Home from './routes/Home'
import Missions from './routes/Missions'
import Mission from './routes/Mission'
import Campaign from './routes/Campaign'
import Dossier from './routes/Dossier'
import Contact from './routes/Contact'
import DraftFight from './routes/DraftFight'
import NotFound from './routes/NotFound'
import { missions } from './data/missions'

export const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'missions', element: <Missions /> },
      {
        path: 'missions/:slug',
        element: <Mission />,
        // Tells the prerenderer which concrete URLs to emit for this pattern.
        getStaticPaths: () => missions.map((m) => `/missions/${m.slug}`),
      },
      { path: 'campaign', element: <Campaign /> },
      { path: 'dossier', element: <Dossier /> },
      { path: 'contact', element: <Contact /> },
      // Unlisted: reached by invite link, deliberately kept out of the nav.
      { path: 'draft-fight', element: <DraftFight /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const createRoot = ViteReactSSG({
  routes,
  basename: import.meta.env.BASE_URL,
})
