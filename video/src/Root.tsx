import "./index.css";
import { Composition, Folder } from "remotion";
import { Hook } from "./scenes/Hook";
import { Problem } from "./scenes/Problem";
import { Solution } from "./scenes/Solution";
import { Mechanism } from "./scenes/Mechanism";
import { DemoWatchtower, DemoRecover } from "./scenes/Demo";
import { Mechanism2, MECH2_FRAMES } from "./scenes/Mechanism2";
import { Future } from "./scenes/Future";
import { Outro } from "./scenes/Outro";
import { Main, TOTAL_FRAMES, DURATIONS } from "./scenes/Main";

const FPS = 30;
const W = 1920;
const H = 1080;

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Chateau-Pitch">
      <Composition id="Main" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    </Folder>

    <Folder name="Scenes">
      <Composition id="Hook"           component={Hook}           durationInFrames={DURATIONS.hook}      fps={FPS} width={W} height={H} />
      <Composition id="Problem"        component={Problem}        durationInFrames={DURATIONS.problem}   fps={FPS} width={W} height={H} />
      <Composition id="Solution"       component={Solution}       durationInFrames={DURATIONS.solution}  fps={FPS} width={W} height={H} />
      <Composition id="Mechanism"      component={Mechanism}      durationInFrames={DURATIONS.mechanism} fps={FPS} width={W} height={H} />
      <Composition id="Mechanism2"     component={Mechanism2}     durationInFrames={MECH2_FRAMES}        fps={FPS} width={W} height={H} />
      <Composition id="DemoWatchtower" component={DemoWatchtower} durationInFrames={DURATIONS.demoWt}   fps={FPS} width={W} height={H} />
      <Composition id="DemoRecover"    component={DemoRecover}    durationInFrames={DURATIONS.demoRec}   fps={FPS} width={W} height={H} />
      <Composition id="Future"         component={Future}         durationInFrames={DURATIONS.future}    fps={FPS} width={W} height={H} />
      <Composition id="Outro"          component={Outro}          durationInFrames={DURATIONS.outro}     fps={FPS} width={W} height={H} />
    </Folder>
  </>
);
