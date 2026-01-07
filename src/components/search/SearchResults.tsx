/**
 * Enhanced search results display with highlighting
 */

import React from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Button,
  Pagination,
} from '@mui/material';
import { Link } from 'react-router-dom';
import type { SearchResult, SearchStats } from '../../services/searchService';
import type { DonorWithType } from '../../types/donor';

interface SearchResultsProps {
  results: SearchResult[];
  stats: SearchStats | null;
  isSearching: boolean;
  showPagination?: boolean;
  itemsPerPage?: number;
  onExportResults?: () => void;
}

const ITEMS_PER_PAGE = 20;

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  stats,
  isSearching,
  showPagination = true,
  itemsPerPage = ITEMS_PER_PAGE,
  onExportResults,
}) => {
  const [currentPage, setCurrentPage] = React.useState(1);

  // Reset page when results change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [results]);

  const totalPages = Math.ceil(results.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedResults = showPagination 
    ? results.slice(startIndex, startIndex + itemsPerPage)
    : results;

  const getTypeDisplayName = (donor: DonorWithType) => {
    // Display the contributor type name (e.g., "Government", "NGOs", "Private Sector")
    return donor.contributorTypeInfo?.NAME || 'Unknown';
  };

  const getTypeColor = (donor: DonorWithType) => {
    // Color based on contributor type - can be enhanced later
    return 'default';
  };

  const renderHighlightedText = (text: string, highlighted?: string) => {
    if (!highlighted || highlighted === text) {
      return text;
    }
    
    // Parse highlighted text with <mark> tags - using Box instead of span for better styling
    return (
      <Box
        component="span"
        dangerouslySetInnerHTML={{ __html: highlighted }}
        sx={(theme) => ({
          '& mark': { 
            backgroundColor: theme.palette.mode === 'dark' ? '#1565c0' : '#bbdefb', 
            padding: '0 2px',
            borderRadius: '2px',
            fontWeight: 'bold',
            color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000'
          }
        })}
      />
    );
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'default';
    if (score > 0.8) return 'success';
    if (score > 0.5) return 'warning';
    return 'error';
  };

  const formatSearchTime = (time: number) => {
    if (time < 1) return '<1ms';
    if (time < 1000) return `${Math.round(time)}ms`;
    return `${(time / 1000).toFixed(2)}s`;
  };

  if (isSearching) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress size={40} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Searching...
        </Typography>
      </Box>
    );
  }

  if (!stats || results.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        {!stats ? 'Enter a search term to find donors' : 'No results found for your search.'}
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      {/* Search Statistics */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{stats.totalResults}</strong> results found in {formatSearchTime(stats.searchTime)}
          </Typography>
          <Chip 
            label={`${stats.searchType} search`} 
            size="small" 
            variant="outlined" 
          />
          {stats.query && (
            <Typography variant="body2" color="text.secondary">
              for "<strong>{stats.query}</strong>"
            </Typography>
          )}
        </Box>
        
        {onExportResults && results.length > 0 && (
          <Button
            variant="outlined"
            size="small"
            onClick={onExportResults}
          >
            Export Results
          </Button>
        )}
      </Box>

      {/* Results Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>NAME</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>CEB CODE</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>TYPE</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>CONTRIBUTOR TYPE</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>RELEVANCE</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ACTIONS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedResults.map((result, index) => {
              const donor = result.item;
              return (
                <TableRow key={`${donor['CEB CODE']}-${index}`} hover>
                  <TableCell>
                    {renderHighlightedText(donor.NAME, result.highlightedName)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {renderHighlightedText(donor['CEB CODE'], result.highlightedCode)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={getTypeDisplayName(donor)}
                      color={getTypeColor(donor)}
                      size="small"
                      title={donor.contributorTypeInfo?.DEFINITION || 'No definition available'}
                      sx={{ 
                        maxWidth: '200px',
                        '& .MuiChip-label': {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={donor['CONTRIBUTOR TYPE'] || 'Unknown'}
                      color="primary"
                      size="small"
                      variant="outlined"
                      title={`${donor['CONTRIBUTOR TYPE']}: ${donor.contributorTypeInfo?.NAME || 'Unknown'}`}
                      sx={{ 
                        fontFamily: 'monospace',
                        fontWeight: 'bold'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {result.score !== undefined && (
                      <Chip
                        label={`${Math.round(result.score * 100)}%`}
                        color={getScoreColor(result.score)}
                        size="small"
                        variant="outlined"
                        title={`Relevance score: ${(result.score * 100).toFixed(1)}%`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        component={Link}
                        to={`/donor-update/${encodeURIComponent(donor['CEB CODE'])}`}
                        variant="contained"
                        size="small"
                        sx={(theme) => ({ 
                          backgroundColor: theme.palette.mode === 'dark' 
                            ? theme.palette.action?.update || '#2196f3'
                            : '#1976d2',
                          color: 'white',
                          '&:hover': { 
                            backgroundColor: theme.palette.mode === 'dark'
                              ? theme.palette.action?.updateHover || '#1976d2'
                              : '#1565c0'
                          }
                        })}
                      >
                        Update
                      </Button>
                      <Button
                        component={Link}
                        to={`/donor-remove/${encodeURIComponent(donor['CEB CODE'])}`}
                        variant="contained"
                        size="small"
                        sx={(theme) => ({ 
                          backgroundColor: theme.palette.mode === 'dark'
                            ? theme.palette.action?.remove || '#1565c0'
                            : '#0d47a1',
                          color: 'white',
                          '&:hover': { 
                            backgroundColor: theme.palette.mode === 'dark'
                              ? theme.palette.action?.removeHover || '#0d47a1'
                              : '#0a237d'
                          }
                        })}
                      >
                        Remove
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(_, page) => setCurrentPage(page)}
            color="primary"
            shape="rounded"
            size="large"
          />
        </Box>
      )}
    </Box>
  );
};

export default SearchResults;
