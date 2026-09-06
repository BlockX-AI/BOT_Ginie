import { useState } from 'react';
import { CodeTab, PreviewTab, TabsLayout } from '../../components/common/TabsLayout';
import { Box, Button } from '@chakra-ui/react';

import Customize from '../../components/common/Preview/Customize';
import CodeExample from '../../components/code/CodeExample';

import PropTable from '../../components/common/Preview/PropTable';
import useForceRerender from '../../hooks/useForceRerender';
import PreviewSwitch from '../../components/common/Preview/PreviewSwitch';

import { profileCard } from '../../constants/code/Components/profileCardCode';
import ProfileCard from '../../content/Components/ProfileCard/ProfileCard';

const ProfileCardDemo = () => {
  const [showIcon, setShowIcon] = useState(true);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [enableMobileTilt, setEnableMobileTilt] = useState(false);
  const [showBehindGlow, setShowBehindGlow] = useState(true);
  const [behindGlowColor, setBehindGlowColor] = useState('rgba(125, 190, 255, 0.67)');
  const [customInnerGradient, setCustomInnerGradient] = useState('linear-gradient(145deg,#60496e8c 0%,#71C4FF44 100%)');

  const [key, forceRerender] = useForceRerender();

  const generateRandomGradients = () => {
    const randomHue1 = Math.floor(Math.random() * 360);
    const randomHue3 = Math.floor(Math.random() * 360);

    const newGlow = `hsla(${randomHue1}, 100%, 70%, 0.6)`;
    const newInnerGradient = `linear-gradient(145deg,hsla(${randomHue1}, 40%, 45%, 0.55) 0%,hsla(${randomHue3}, 60%, 70%, 0.27) 100%)`;

    setBehindGlowColor(newGlow);
    setCustomInnerGradient(newInnerGradient);
    forceRerender();
  };

  const propData = [
    {
      name: 'avatarUrl',
      type: 'string',
      default: '"<Placeholder for avatar URL>"',
      description: 'URL for the main avatar image displayed on the card'
    },
    {
      name: 'iconUrl',
      type: 'string',
      default: '"<Placeholder for icon URL>"',
      description: 'Optional URL for an icon pattern overlay on the card background'
    },
    {
      name: 'grainUrl',
      type: 'string',
      default: '"<Placeholder for grain URL>"',
      description: 'Optional URL for a grain texture overlay effect'
    },
    {
      name: 'innerGradient',
      type: 'string',
      default: 'undefined',
      description: 'Custom CSS gradient string for the inner card gradient'
    },
    {
      name: 'behindGlowEnabled',
      type: 'boolean',
      default: 'true',
      description: 'Toggle the smooth radial glow that follows the cursor behind the card'
    },
    {
      name: 'behindGlowColor',
      type: 'string',
      default: '"rgba(125, 190, 255, 0.67)"',
      description: 'CSS color for the behind-the-card glow (e.g. rgba/hsla/hex)'
    },
    {
      name: 'behindGlowSize',
      type: 'string',
      default: '"50%"',
      description: 'Size of the glow as a length/percentage stop in the radial gradient'
    },
    {
      name: 'className',
      type: 'string',
      default: '""',
      description: 'Additional CSS classes to apply to the card wrapper'
    },
    {
      name: 'enableTilt',
      type: 'boolean',
      default: 'true',
      description: 'Enable or disable the 3D tilt effect on mouse hover'
    },
    {
      name: 'enableMobileTilt',
      type: 'boolean',
      default: 'false',
      description: 'Enable or disable the 3D tilt effect on mobile devices'
    },
    {
      name: 'mobileTiltSensitivity',
      type: 'number',
      default: '5',
      description: 'Sensitivity of the 3D tilt effect on mobile devices'
    },
    {
      name: 'miniAvatarUrl',
      type: 'string',
      default: 'undefined',
      description: 'Optional URL for a smaller avatar in the user info section'
    },
    {
      name: 'name',
      type: 'string',
      default: '"Javi A. Torres"',
      description: "User's display name"
    },
    {
      name: 'title',
      type: 'string',
      default: '"Software Engineer"',
      description: "User's job title or role"
    },
    {
      name: 'handle',
      type: 'string',
      default: '"javicodes"',
      description: "User's handle or username (displayed with @ prefix)"
    },
    {
      name: 'status',
      type: 'string',
      default: '"Online"',
      description: "User's current status"
    },
    {
      name: 'contactText',
      type: 'string',
      default: '"Contact"',
      description: 'Text displayed on the contact button'
    },
    {
      name: 'showUserInfo',
      type: 'boolean',
      default: 'true',
      description: 'Whether to display the user information section'
    },
    {
      name: 'onContactClick',
      type: 'function',
      default: 'undefined',
      description: 'Callback function called when the contact button is clicked'
    }
  ];

  return (
    <TabsLayout>
      <PreviewTab>
        <Box position="relative" className="demo-container" h={700} overflow="hidden">
          <ProfileCard
            key={key}
            name="Javi A. Torres"
            title="Software Engineer"
            handle="javicodes"
            status="Online"
            contactText="Contact Me"
            avatarUrl="/assets/demo/person.webp"
            iconUrl={showIcon ? '/assets/demo/iconpattern.png' : ''}
            showUserInfo={showUserInfo}
            grainUrl="/assets/demo/grain.webp"
            behindGlowEnabled={showBehindGlow}
            behindGlowColor={behindGlowColor}
            innerGradient={customInnerGradient}
            enableMobileTilt={enableMobileTilt}
          />
        </Box>{' '}
        <Customize>
          <Button
            onClick={generateRandomGradients}
            fontSize="xs"
            bg="#170D27"
            borderRadius="10px"
            border="1px solid #271E37"
            _hover={{ bg: '#271E37' }}
            color="#fff"
            h={8}
          >
            Randomize Colors
          </Button>

          <PreviewSwitch
            title="Behind Glow"
            isChecked={showBehindGlow}
            onChange={() => {
              setShowBehindGlow(!showBehindGlow);
              forceRerender();
            }}
          />
          <PreviewSwitch
            title="Show Icon Pattern"
            isChecked={showIcon}
            onChange={() => {
              setShowIcon(!showIcon);
              forceRerender();
            }}
          />
          <PreviewSwitch
            title="Show User Info"
            isChecked={showUserInfo}
            onChange={() => {
              setShowUserInfo(!showUserInfo);
              forceRerender();
            }}
          />
          <PreviewSwitch
            title="Enable Mobile Tilt"
            isChecked={enableMobileTilt}
            onChange={() => {
              setEnableMobileTilt(!enableMobileTilt);
              forceRerender();
            }}
          />
        </Customize>
        <PropTable data={propData} />
      </PreviewTab>

      <CodeTab>
        <CodeExample codeObject={profileCard} />
      </CodeTab>
    </TabsLayout>
  );
};

export default ProfileCardDemo;
