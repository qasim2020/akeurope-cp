const generatePagination = function (totalPages, currentPage) {
    const pagination = [];
    const maxVisiblePages = 2;
  
    if (totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= totalPages; i++) pagination.push(i);
    } else {
      pagination.push(1);
  
      if (currentPage > maxVisiblePages / 2 + 1) pagination.push("...");
  
      let startPage = Math.max(2, currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages - 1, currentPage + Math.floor(maxVisiblePages / 2));
  
      if (currentPage <= maxVisiblePages / 2) endPage = maxVisiblePages;
      if (currentPage > totalPages - maxVisiblePages / 2) startPage = totalPages - maxVisiblePages + 1;
  
      for (let i = startPage; i <= endPage; i++) pagination.push(i);
  
      if (currentPage < totalPages - maxVisiblePages / 2 - 1) pagination.push("...");
      if (pagination[pagination.length - 1] !== totalPages) pagination.push(totalPages);
    }
  
    return pagination;
  };
  
  module.exports = { generatePagination };
  