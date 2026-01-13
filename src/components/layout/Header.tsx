'use client';

import { AppBar, Toolbar, Typography, IconButton, Box } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LocalBarIcon from '@mui/icons-material/LocalBar';

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export default function Header({ onMenuClick, showMenuButton = true }: HeaderProps) {
  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'primary.main',
      }}
    >
      <Toolbar>
        {showMenuButton && (
          <IconButton
            color="inherit"
            aria-label="メニューを開く"
            edge="start"
            onClick={onMenuClick}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <LocalBarIcon sx={{ mr: 1.5 }} />
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          シードル市場分析ダッシュボード
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            ゲストモード
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
