import { CoreProvider } from './core/CoreProvider.tsx';
import { useRoute } from './router.ts';
import { AreaScreen } from './screens/AreaScreen.tsx';
import { MainMenu } from './screens/MainMenu.tsx';
import { Settings } from './screens/Settings.tsx';
import styles from './App.module.css';

export function App() {
  const route = useRoute();

  let screen;
  switch (route.name) {
    case 'menu':
      screen = <MainMenu />;
      break;
    case 'settings':
      screen = <Settings />;
      break;
    case 'area':
      screen = <AreaScreen key={route.areaId} areaId={route.areaId} query={route.query} />;
      break;
  }

  return (
    <CoreProvider>
      <div className={styles.app}>{screen}</div>
    </CoreProvider>
  );
}
