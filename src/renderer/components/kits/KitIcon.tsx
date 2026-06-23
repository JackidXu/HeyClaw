import React, { useState } from 'react';

import SidebarKitsIcon from '../icons/SidebarKitsIcon';

interface KitIconProps {
  icon?: string;
  className?: string;
  fallbackClassName?: string;
  fallbackIconClassName?: string;
  style?: React.CSSProperties;
}

// 追热点达人 🔥
const HotspotAvatar: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="20" rx="26" ry="22" fill="#2d1b0e"/>
    <ellipse cx="36" cy="36" rx="20" ry="20" fill="#fdd7b8"/>
    <path d="M14 28 Q16 16 24 18 Q28 10 36 12 Q44 10 48 18 Q56 16 58 28 Q52 22 44 24 Q36 16 28 24 Q20 22 14 28Z" fill="#2d1b0e"/>
    <ellipse cx="14" cy="36" rx="4" ry="14" fill="#2d1b0e"/>
    <ellipse cx="58" cy="36" rx="4" ry="14" fill="#2d1b0e"/>
    <ellipse cx="30" cy="34" rx="4" ry="3.5" fill="white"/>
    <ellipse cx="42" cy="34" rx="4" ry="3.5" fill="white"/>
    <circle cx="31" cy="34" r="2.2" fill="#3b1f0b"/><circle cx="43" cy="34" r="2.2" fill="#3b1f0b"/>
    <circle cx="31.7" cy="33" r="0.8" fill="white"/><circle cx="43.7" cy="33" r="0.8" fill="white"/>
    <path d="M26 28 Q30 25 34 26" stroke="#251205" strokeWidth={1.8} strokeLinecap="round" fill="none"/>
    <path d="M38 26 Q42 25 46 28" stroke="#251205" strokeWidth={1.8} strokeLinecap="round" fill="none"/>
    <path d="M30 43 Q36 47 42 43" stroke="#b86a5a" strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <ellipse cx="24" cy="38" rx="4" ry="2" fill="#f5a0a0" opacity="0.3"/>
  </svg>
);

// 老板IP选题王 👑
const IptopicAvatar: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="22" rx="28" ry="20" fill="#1a1a2e"/>
    <ellipse cx="36" cy="36" rx="20" ry="20" fill="#ffe0bd"/>
    <path d="M10 28 Q12 14 20 12 Q28 6 36 8 Q44 6 52 12 Q60 14 62 28 Q54 18 44 16 Q36 10 28 16 Q18 18 10 28Z" fill="#1a1a2e"/>
    <ellipse cx="13" cy="36" rx="5" ry="15" fill="#1a1a2e"/><ellipse cx="59" cy="36" rx="5" ry="15" fill="#1a1a2e"/>
    <ellipse cx="30" cy="34" rx="4" ry="3.8" fill="white"/><ellipse cx="42" cy="34" rx="4" ry="3.8" fill="white"/>
    <circle cx="31" cy="34" r="2.2" fill="#16213e"/><circle cx="43" cy="34" r="2.2" fill="#16213e"/>
    <circle cx="31.8" cy="33" r="0.9" fill="white"/><circle cx="43.8" cy="33" r="0.9" fill="white"/>
    <path d="M25 28 Q30 25 35 27" stroke="#0a0a1a" strokeWidth={1.8} strokeLinecap="round" fill="none"/>
    <path d="M37 27 Q42 30 47 28" stroke="#0a0a1a" strokeWidth={1.8} strokeLinecap="round" fill="none"/>
    <path d="M30 43 Q36 48 42 43" stroke="#d4947a" strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <rect x="24" y="31" width="14" height="9" rx="4" stroke="#2d3436" strokeWidth={1.5} fill="none"/>
    <rect x="36" y="31" width="14" height="9" rx="4" stroke="#2d3436" strokeWidth={1.5} fill="none"/>
    <line x1="38" y1="35" x2="36" y2="35" stroke="#2d3436" strokeWidth={1.5}/>
    <ellipse cx="24" cy="38" rx="4" ry="2" fill="#f5a0a0" opacity="0.25"/>
  </svg>
);

// 封面图设计师 🎨
const CoverdesignAvatar: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="20" rx="26" ry="18" fill="#4a2c5e"/><ellipse cx="36" cy="36" rx="19" ry="19" fill="#fde8d0"/>
    <path d="M14 28 Q16 16 26 14 Q32 8 36 10 Q40 8 46 14 Q56 16 58 28 Q50 20 42 18 Q36 12 30 18 Q22 20 14 28Z" fill="#4a2c5e"/>
    <path d="M54 28 Q60 40 56 52 Q52 60 48 56 Q50 44 52 36 Q54 28 54 28Z" fill="#4a2c5e"/>
    <ellipse cx="30" cy="34" rx="4.5" ry="4.5" fill="white"/><ellipse cx="43" cy="34" rx="4.5" ry="4.5" fill="white"/>
    <circle cx="31" cy="34" r="2.5" fill="#3b1f4a"/><circle cx="44" cy="34" r="2.5" fill="#3b1f4a"/>
    <circle cx="32" cy="32.5" r="1" fill="white"/><circle cx="45" cy="32.5" r="1" fill="white"/>
    <path d="M26 30 Q28 28 31 28" stroke="#2a1535" strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <path d="M40 28 Q43 28 45 30" stroke="#2a1535" strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <path d="M31 43 Q36 47 41 43" stroke="#d4947a" strokeWidth={1.6} strokeLinecap="round" fill="none"/>
    <ellipse cx="24" cy="38" rx="4" ry="2.5" fill="#f5a0c0" opacity="0.3"/>
    <ellipse cx="36" cy="15" rx="20" ry="6" fill="#e8a0c0" opacity="0.5"/><circle cx="50" cy="14" r="1.5" fill="#c47a9a"/>
  </svg>
);

// 文案炼金术士 ✍️
const AlchemistAvatar: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="20" rx="26" ry="20" fill="#c8d6e5"/><ellipse cx="36" cy="36" rx="19" ry="19" fill="#fce4cc"/>
    <path d="M12 28 Q14 14 22 12 Q30 6 36 8 Q42 6 50 12 Q58 14 60 28 Q52 16 44 14 Q36 8 28 14 Q20 16 12 28Z" fill="#c8d6e5"/>
    <ellipse cx="13" cy="37" rx="5" ry="13" fill="#c8d6e5"/><ellipse cx="59" cy="37" rx="4" ry="13" fill="#c8d6e5"/>
    <ellipse cx="30" cy="34" rx="4" ry="3.5" fill="white"/><ellipse cx="42" cy="34" rx="4" ry="3.5" fill="white"/>
    <circle cx="31" cy="34" r="2.2" fill="#2c3e50"/><circle cx="43" cy="34" r="2.2" fill="#2c3e50"/>
    <circle cx="31.8" cy="33" r="0.8" fill="white"/><circle cx="43.8" cy="33" r="0.8" fill="white"/>
    <path d="M26 29 Q30 26 34 27" stroke="#1e272e" strokeWidth={1.8} strokeLinecap="round" fill="none"/>
    <path d="M38 27 Q42 26 46 29" stroke="#1e272e" strokeWidth={1.8} strokeLinecap="round" fill="none"/>
    <path d="M30 43 Q36 49 42 43" stroke="#c47a6a" strokeWidth={1.5} strokeLinecap="round" fill="none"/>
    <path d="M58 20l1-2 2-1-2-1-1-2-1 2-2 1 2 1z" fill="#f0c040"/>
  </svg>
);

// 排版强迫症 📐
const LayoutocdAvatar: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="20" rx="25" ry="18" fill="#1e1e3a"/><ellipse cx="36" cy="36" rx="19" ry="19" fill="#ffecd0"/>
    <path d="M13 28 Q14 14 22 12 Q30 6 36 8 Q42 6 50 12 Q58 14 59 28 Q52 18 44 16 Q36 10 28 16 Q20 18 13 28Z" fill="#1e1e3a"/>
    <ellipse cx="14" cy="38" rx="5" ry="12" fill="#1e1e3a"/><ellipse cx="58" cy="38" rx="4" ry="12" fill="#1e1e3a"/>
    <ellipse cx="30" cy="34" rx="3.8" ry="3.5" fill="white"/><ellipse cx="42" cy="34" rx="3.8" ry="3.5" fill="white"/>
    <circle cx="31" cy="34" r="2.2" fill="#0a0a2e"/><circle cx="43" cy="34" r="2.2" fill="#0a0a2e"/>
    <circle cx="31.8" cy="33" r="0.8" fill="white"/><circle cx="43.8" cy="33" r="0.8" fill="white"/>
    <path d="M27 28 Q30 26 32 27" stroke="#0a0a1a" strokeWidth={1.6} strokeLinecap="round" fill="none"/>
    <path d="M40 27 Q42 26 45 28" stroke="#0a0a1a" strokeWidth={1.6} strokeLinecap="round" fill="none"/>
    <path d="M32 42 Q36 45 40 42" stroke="#c97a6a" strokeWidth={1.4} strokeLinecap="round" fill="none"/>
    <rect x="52" y="10" width="3" height="35" rx="1" fill="#6366f1" transform="rotate(20 53 27)"/>
  </svg>
);

// 口播脚本导演 🎬
const ScriptdirectorAvatar: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="18" rx="28" ry="20" fill="#c44a2a"/><ellipse cx="36" cy="36" rx="19" ry="19" fill="#ffe4c4"/>
    <path d="M10 26 Q12 10 20 8 Q28 2 36 4 Q44 2 52 8 Q60 10 62 26 Q54 14 44 12 Q36 4 28 12 Q18 14 10 26Z" fill="#c44a2a"/>
    <ellipse cx="14" cy="37" rx="5" ry="13" fill="#c44a2a"/><ellipse cx="58" cy="37" rx="4" ry="13" fill="#c44a2a"/>
    <ellipse cx="30" cy="34" rx="4.5" ry="4" fill="white"/><ellipse cx="42" cy="34" rx="4.5" ry="4" fill="white"/>
    <circle cx="31" cy="34" r="2.3" fill="#5a1a0a"/><circle cx="43" cy="34" r="2.3" fill="#5a1a0a"/>
    <circle cx="32" cy="33" r="0.9" fill="white"/><circle cx="44" cy="33" r="0.9" fill="white"/>
    <path d="M25 28 Q30 24 35 27" stroke="#2a0a02" strokeWidth={1.8} strokeLinecap="round" fill="none"/>
    <path d="M37 27 Q42 24 47 28" stroke="#2a0a02" strokeWidth={1.8} strokeLinecap="round" fill="none"/>
    <path d="M29 43 Q36 50 43 43" stroke="#c47a5a" strokeWidth={2} strokeLinecap="round" fill="#ffddd0" opacity="0.4"/>
    <ellipse cx="24" cy="38" rx="4" ry="2.5" fill="#f5a0a0" opacity="0.3"/>
  </svg>
);

// 数据翻译官 📊
const DatatransAvatar: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="20" rx="25" ry="18" fill="#1e3a5f"/><ellipse cx="36" cy="36" rx="19" ry="19" fill="#ffe8cc"/>
    <path d="M13 28 Q14 14 22 12 Q30 6 36 8 Q42 6 50 12 Q58 14 59 28 Q52 18 44 16 Q36 10 28 16 Q20 18 13 28Z" fill="#1e3a5f"/>
    <ellipse cx="14" cy="37" rx="5" ry="12" fill="#1e3a5f"/><ellipse cx="58" cy="37" rx="4" ry="12" fill="#1e3a5f"/>
    <ellipse cx="30" cy="34" rx="4" ry="3.5" fill="white"/><ellipse cx="42" cy="34" rx="4" ry="3.5" fill="white"/>
    <circle cx="31" cy="34" r="2.2" fill="#0f172a"/><circle cx="43" cy="34" r="2.2" fill="#0f172a"/>
    <circle cx="31.8" cy="33" r="0.8" fill="white"/><circle cx="43.8" cy="33" r="0.8" fill="white"/>
    <path d="M27 29 Q30 27 33 28" stroke="#0a0a1e" strokeWidth={1.6} strokeLinecap="round" fill="none"/>
    <path d="M39 28 Q42 27 45 29" stroke="#0a0a1e" strokeWidth={1.6} strokeLinecap="round" fill="none"/>
    <path d="M32 43 Q36 46 40 43" stroke="#b47a6a" stroke-width={1.4} strokeLinecap="round" fill="none"/>
    <rect x="25" y="31" width="12" height="8" rx="4" stroke="#334155" strokeWidth={1.5} fill="none"/>
    <rect x="37" y="31" width="12" height="8" rx="4" stroke="#334155" strokeWidth={1.5} fill="none"/>
    <line x1="37" y1="35" x2="36" y2="35" stroke="#334155" strokeWidth={1.5}/>
  </svg>
);

const getAvatarSvg = (key: string) => {
  switch (key) {
    case 'hotspot':
      return <HotspotAvatar />;
    case 'iptopic':
      return <IptopicAvatar />;
    case 'coverdesign':
      return <CoverdesignAvatar />;
    case 'alchemist':
      return <AlchemistAvatar />;
    case 'layoutocd':
      return <LayoutocdAvatar />;
    case 'scriptdirector':
      return <ScriptdirectorAvatar />;
    case 'datatrans':
      return <DatatransAvatar />;
    default:
      return null;
  }
};

const KitIcon: React.FC<KitIconProps> = ({
  icon,
  className = 'h-16 w-16',
  fallbackClassName = 'bg-primary-muted text-primary',
  fallbackIconClassName = 'h-1/2 w-1/2',
  style,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedIcon = icon?.trim();

  if (normalizedIcon?.startsWith('avatar:')) {
    const avatarKey = normalizedIcon.replace('avatar:', '');
    const avatarSvg = getAvatarSvg(avatarKey);
    if (avatarSvg) {
      return React.cloneElement(avatarSvg, {
        className: `${className} animate-avatar-float transition-transform duration-300 group-hover:scale-[1.08] group-hover:animate-none`,
        style
      });
    }
  }

  if (normalizedIcon && !imageFailed) {
    return (
      <img
        alt=""
        className={`${className} shrink-0 object-contain`}
        draggable={false}
        src={normalizedIcon}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span className={`${className} ${fallbackClassName} inline-flex shrink-0 items-center justify-center rounded-xl`}>
      <SidebarKitsIcon className={fallbackIconClassName} />
    </span>
  );
};

export default KitIcon;
