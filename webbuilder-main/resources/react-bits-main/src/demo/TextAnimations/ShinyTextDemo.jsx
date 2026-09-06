import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import { CodeTab, PreviewTab, TabsLayout } from '../../components/common/TabsLayout';

import CodeExample from '../../components/code/CodeExample';
import PropTable from '../../components/common/Preview/PropTable';

import PreviewSlider from '../../components/common/Preview/PreviewSlider';
import Customize from '../../components/common/Preview/Customize';

import ShinyText from '../../content/TextAnimations/ShinyText/ShinyText';
import { shinyText } from '../../constants/code/TextAnimations/shinyTextCode';

const ShinyTextDemo = () => {
  const [speed, setSpeed] = useState(3);

  const propData = [
    {
      name: 'text',
      type: 'string',
      default: '-',
      description: 'The text to be displayed with the shiny effect.'
    },
    {
      name: 'disabled',
      type: 'boolean',
      default: 'false',
      description: 'Disables the shiny effect when set to true.'
    },
    {
      name: 'speed',
      type: 'number',
      default: '5',
      description: 'Specifies the duration of the animation in seconds.'
    },
    {
      name: 'className',
      type: 'string',
      default: "''",
      description: 'Adds custom classes to the root element.'
    }
  ];

  return (
    <TabsLayout>
      <PreviewTab>
        <Box position="relative" className="demo-container" minH={400} fontSize="24px">
          <ShinyText text="Thinking..." disabled={false} speed={speed} className="shiny-text-demo" />
        </Box>

        <Customize>
          <PreviewSlider
            title="Animation Duration"
            min={1}
            max={5}
            step={0.1}
            value={speed}
            valueUnit="s"
            onChange={setSpeed}
          />
        </Customize>

        <PropTable data={propData} />
      </PreviewTab>

      <CodeTab>
        <CodeExample codeObject={shinyText} />
      </CodeTab>
    </TabsLayout>
  );
};

export default ShinyTextDemo;
