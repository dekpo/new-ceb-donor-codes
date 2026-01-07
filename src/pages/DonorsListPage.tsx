import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Pagination,
  CircularProgress,
  Alert,
  Chip,
  Link as MuiLink,
  InputAdornment,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useDataContext } from '../context/DataContext';
import { useSearch } from '../hooks/useSearch';
import { SearchType, SearchField } from '../services/searchService';
import SearchSuggestions from '../components/search/SearchSuggestions';
import type { DonorWithType } from '../types/donor';

const ITEMS_PER_PAGE = 20;

const DonorsListPage: React.FC = () => {
  const { donorsWithTypes, loading, error, reload } = useDataContext();
  const [currentPage, setCurrentPage] = useState(1);
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);
  
  // Enhanced search functionality
  const {
    query,
    searchType,
    searchField,
    results,
    stats,
    isSearching,
    setQuery,
    setSearchType,
    setSearchField,
    clearSearch,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    searchFromSuggestion,
    filters,
    setFilters,
  } = useSearch({
    defaultSearchType: SearchType.FUZZY,
    defaultSearchField: SearchField.ALL,
    debounceDelay: 300,
    enableSuggestions: true,
    enableHistory: false, // Disable history for list page
  });

  // Determine which data to display
  const displayData = React.useMemo(() => {
    if (query.trim() && useAdvancedSearch) {
      // Use enhanced search results
      return results.map(result => result.item);
    } else if (query.trim()) {
      // Fallback to basic regex search for backward compatibility with safety checks
      const regex = new RegExp(query.trim(), 'gi');
      return donorsWithTypes.filter(donor => {
        // Safety checks for undefined data
        if (!donor || !donor.NAME || !donor['CEB CODE']) return false;
        return donor.NAME.match(regex) || donor['CEB CODE'].match(regex);
      });
    } else {
      // Show all donors when no search
      return donorsWithTypes;
    }
  }, [query, useAdvancedSearch, results, donorsWithTypes]);

  // Sort and paginate data with safety checks
  const sortedData = React.useMemo(() => {
    return [...displayData].sort((a, b) => {
      // Safety checks for undefined data
      const nameA = a?.NAME || '';
      const nameB = b?.NAME || '';
      return nameA.localeCompare(nameB);
    });
  }, [displayData]);

  const paginatedDonors = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  // Reset to first page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [query, useAdvancedSearch]);

  const getTypeDisplayName = (donor: DonorWithType) => {
    // Display the contributor type name (e.g., "Government", "NGOs", "Private Sector")
    return donor.contributorTypeInfo?.NAME || 'Unknown';
  };

  const getTypeColor = (donor: DonorWithType) => {
    // Color based on contributor type - can be enhanced later
    return 'default';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading donor data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Box sx={{ textAlign: 'center' }}>
          <Button variant="contained" onClick={reload} color="primary">
            Retry Loading Data
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ textAlign: 'center', mb: 3 }}>
        CEB Donor Codes
      </Typography>

      {/* Enhanced Search Controls */}
      <Box sx={{ mb: 3 }}>
        {/* Search Mode Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <ToggleButtonGroup
            value={useAdvancedSearch ? 'advanced' : 'basic'}
            exclusive
            onChange={(_, value) => {
              if (value !== null) {
                setUseAdvancedSearch(value === 'advanced');
              }
            }}
            size="small"
          >
            <ToggleButton value="basic">Basic Search</ToggleButton>
            <ToggleButton value="advanced">Smart Search</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Search Input */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', position: 'relative' }}>
          {useAdvancedSearch && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Search Type</InputLabel>
              <Select
                value={searchType}
                label="Search Type"
                onChange={(e) => setSearchType(e.target.value as SearchType)}
              >
                <MenuItem value={SearchType.FUZZY}>Smart (Fuzzy)</MenuItem>
                <MenuItem value={SearchType.PARTIAL}>Partial</MenuItem>
                <MenuItem value={SearchType.EXACT}>Exact</MenuItem>
                <MenuItem value={SearchType.SOUNDEX}>Sounds Like</MenuItem>
              </Select>
            </FormControl>
          )}
          
          <Box sx={{ position: 'relative', minWidth: 300 }}>
            <TextField
              size="small"
              placeholder={useAdvancedSearch ? "Try: 'unted nations' or 'WHO'" : "Search..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color={isSearching ? 'primary' : 'action'} />
                  </InputAdornment>
                ),
                endAdornment: query && (
                  <InputAdornment position="end">
                    <IconButton onClick={clearSearch} size="small" title="Clear search">
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ width: '100%' }}
            />
            
            {/* Search Suggestions */}
            {useAdvancedSearch && (
              <SearchSuggestions
                suggestions={suggestions}
                searchHistory={[]}
                query={query}
                show={showSuggestions}
                onSuggestionClick={searchFromSuggestion}
                onHistoryClick={() => {}}
                onClose={() => setShowSuggestions(false)}
              />
            )}
          </Box>

          {useAdvancedSearch && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Search In</InputLabel>
              <Select
                value={searchField}
                label="Search In"
                onChange={(e) => setSearchField(e.target.value as SearchField)}
              >
                <MenuItem value={SearchField.ALL}>All Fields</MenuItem>
                <MenuItem value={SearchField.NAME}>Name Only</MenuItem>
                <MenuItem value={SearchField.CEB_CODE}>Code Only</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>

        {/* Quick Filters for Advanced Search */}
        {useAdvancedSearch && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            <Chip
              label="Government"
              clickable
              color={filters.governmentOnly ? 'primary' : 'default'}
              variant={filters.governmentOnly ? 'filled' : 'outlined'}
              onClick={() => setFilters({ 
                governmentOnly: !filters.governmentOnly,
                nonGovernmentOnly: false 
              })}
              size="small"
            />
            <Chip
              label="Non-Government"
              clickable
              color={filters.nonGovernmentOnly ? 'primary' : 'default'}
              variant={filters.nonGovernmentOnly ? 'filled' : 'outlined'}
              onClick={() => setFilters({ 
                nonGovernmentOnly: !filters.nonGovernmentOnly,
                governmentOnly: false 
              })}
              size="small"
            />
            {(filters.governmentOnly || filters.nonGovernmentOnly || filters.contributorTypes.length > 0) && (
              <Chip
                label="Clear Filters"
                clickable
                color="secondary"
                variant="outlined"
                onClick={() => setFilters({ 
                  governmentOnly: false, 
                  nonGovernmentOnly: false,
                  contributorTypes: []
                })}
                size="small"
                icon={<ClearIcon />}
              />
            )}
          </Box>
        )}
      </Box>

      {/* Results Summary */}
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            {query ? (
              <>
                <strong>{sortedData.length}</strong> results found
                {useAdvancedSearch && stats && (
                  <> in {stats.searchTime < 1 ? '<1ms' : `${Math.round(stats.searchTime)}ms`}</>
                )}
              </>
            ) : (
              <><strong>{donorsWithTypes.length}</strong> total donors</>
            )}
          </Typography>
          {query && useAdvancedSearch && (
            <Chip 
              label={`${searchType} search`} 
              size="small" 
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {/* Donors Table */}
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>NAME</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>CEB CODE</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>TYPE</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>CONTRIBUTOR TYPE</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ACTIONS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedDonors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  No Results
                </TableCell>
              </TableRow>
            ) : (
              paginatedDonors.map((donor, index) => {
                // Safety check for undefined donor data
                if (!donor || !donor.NAME || !donor['CEB CODE']) {
                  return (
                    <TableRow key={`error-${index}`}>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'error.main' }}>
                        Invalid donor data
                      </TableCell>
                    </TableRow>
                  );
                }
                
                return (
                  <TableRow key={`${donor['CEB CODE']}-${index}`} hover>
                    <TableCell>{donor.NAME}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {donor['CEB CODE']}
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
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {!query && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            shape="rounded"
            size="large"
          />
        </Box>
      )}

      {/* Data Source Info */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Data loaded from{' '}
          <MuiLink
            href="https://github.com/CEB-HLCM/FS-Public-Codes"
            target="_blank"
            rel="noopener noreferrer"
          >
            CEB-HLCM/FS-Public-Codes
          </MuiLink>
          {' '}repository
        </Typography>
      </Box>
    </Container>
  );
};

export default DonorsListPage;
